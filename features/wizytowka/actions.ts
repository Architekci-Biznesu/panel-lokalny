"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { invalidateGbpReads } from "@/lib/integrations/gbp/read-cache";
import { z } from "zod";
import { startGbpAudit } from "@/features/wizytowka/audit";
import { buildAttributeUpdateBody } from "@/features/wizytowka/attributes";
import { stripReviewFluffFromDescription } from "@/features/wizytowka/description-sanitize";
import {
  draftsToServiceItems,
  parseTime,
  type ServiceItemDraft,
} from "@/features/wizytowka/types";
import { GBP_DESCRIPTION_MAX, clampTextToLimit } from "@/lib/ai/gbp-limits";
import { db } from "@/lib/db";
import { appendBriefAvoid } from "@/lib/brief";
import { gbpSuggestions, napInterestRequests } from "@/lib/db/schema";
import {
  getActiveGbpProfile,
  getGbpAccessTokenForProfile,
  GbpNotConnectedError,
} from "@/lib/integrations/gbp/access";
import {
  fetchGbpLocationDetails,
  patchGbpLocation,
  updateGbpLocationAttributes,
} from "@/lib/integrations/gbp/client";
import { autocompleteRegions } from "@/lib/integrations/places/client";
import { getActiveProfile, requireOwnedProfile } from "@/lib/session";
import { parseLocation } from "@/features/wizytowka/types";

type ActionResult = { ok: true } | { ok: false; error: string };

function fail(error: unknown): ActionResult {
  if (error instanceof GbpNotConnectedError) {
    return { ok: false, error: error.message };
  }
  return {
    ok: false,
    error: error instanceof Error ? error.message : "Nie udało się zapisać",
  };
}

async function withGbpPatch(
  updateMask: string[],
  body: Record<string, unknown>,
): Promise<ActionResult> {
  try {
    const profile = await getActiveGbpProfile();
    const token = await getGbpAccessTokenForProfile(profile);
    await patchGbpLocation(token, profile.gbpLocationId!, body, updateMask);
    invalidateGbpReads();
    revalidatePath("/wizytowka", "layout");
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

const titleSchema = z.object({
  title: z.string().trim().min(1).max(100),
});

export async function updateGbpTitle(input: unknown): Promise<ActionResult> {
  const parsed = titleSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Podaj poprawną nazwę firmy (max 100 znaków)" };
  }
  return withGbpPatch(["title"], { title: parsed.data.title });
}

const descriptionSchema = z.object({
  description: z.string().trim().min(1).max(750),
});

export async function updateGbpDescription(
  input: unknown,
): Promise<ActionResult> {
  const parsed = descriptionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Opis musi mieć 1-750 znaków" };
  }
  return withGbpPatch(["profile.description"], {
    profile: { description: parsed.data.description },
  });
}

const categoriesSchema = z.object({
  primaryCategoryName: z.string().min(1),
  additionalCategoryNames: z.array(z.string()).max(9),
});

export async function updateGbpCategories(
  input: unknown,
): Promise<ActionResult> {
  const parsed = categoriesSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Wybierz kategorie ze słownika Google" };
  }
  const { primaryCategoryName, additionalCategoryNames } = parsed.data;
  return withGbpPatch(["categories"], {
    categories: {
      primaryCategory: { name: primaryCategoryName },
      additionalCategories: additionalCategoryNames.map((name) => ({ name })),
    },
  });
}

const serviceItemSchema = z.object({
  kind: z.enum(["structured", "freeForm"]),
  serviceTypeId: z.string().optional(),
  category: z.string().optional(),
  displayName: z.string().max(140),
  description: z.string().max(250).optional(),
});

const servicesSchema = z.object({
  services: z.array(serviceItemSchema).max(40),
});

export async function updateGbpServices(input: unknown): Promise<ActionResult> {
  const parsed = servicesSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Nazwa usługi max 140 znaków, opis max 250 znaków",
    };
  }

  try {
    const profile = await getActiveGbpProfile();
    const token = await getGbpAccessTokenForProfile(profile);
    const raw = await fetchGbpLocationDetails(token, profile.gbpLocationId!);
    const location = parseLocation(raw);

    if (location.metadata?.canModifyServiceList === false) {
      return {
        ok: false,
        error:
          "Ta lokalizacja nie pozwala edytować listy usług w Google (canModifyServiceList).",
      };
    }

    const drafts = parsed.data.services as ServiceItemDraft[];
    await patchGbpLocation(
      token,
      profile.gbpLocationId!,
      { serviceItems: draftsToServiceItems(drafts) },
      ["serviceItems"],
    );
    invalidateGbpReads();
    revalidatePath("/wizytowka", "layout");
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

const openInfoSchema = z.object({
  status: z
    .enum(["OPEN", "CLOSED_TEMPORARILY", "CLOSED_PERMANENTLY"])
    .optional(),
  openingDate: z
    .object({
      year: z.number().int().min(1800).max(2100),
      month: z.number().int().min(1).max(12).optional(),
      day: z.number().int().min(1).max(31).optional(),
    })
    .optional(),
});

export async function updateGbpOpenInfo(input: unknown): Promise<ActionResult> {
  const parsed = openInfoSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Niepoprawne dane otwarcia" };
  }
  return withGbpPatch(["openInfo"], { openInfo: parsed.data });
}

const phoneSchema = z.object({
  primaryPhone: z.string().trim().min(5).max(30),
  additionalPhones: z.array(z.string().trim().min(5).max(30)).max(2).optional(),
});

export async function updateGbpPhones(input: unknown): Promise<ActionResult> {
  const parsed = phoneSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Podaj poprawny numer telefonu" };
  }
  return withGbpPatch(["phoneNumbers"], {
    phoneNumbers: {
      primaryPhone: parsed.data.primaryPhone,
      additionalPhones: parsed.data.additionalPhones,
    },
  });
}

const websiteSchema = z.object({
  websiteUri: z.string().trim().url().max(500),
});

export async function updateGbpWebsite(input: unknown): Promise<ActionResult> {
  const parsed = websiteSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Podaj poprawny adres URL witryny" };
  }
  return withGbpPatch(["websiteUri"], { websiteUri: parsed.data.websiteUri });
}

const addressSchema = z.object({
  regionCode: z.string().length(2).default("PL"),
  postalCode: z.string().trim().max(20).optional(),
  administrativeArea: z.string().trim().max(80).optional(),
  locality: z.string().trim().max(80).optional(),
  addressLines: z.array(z.string().trim().min(1).max(120)).min(1).max(3),
});

export async function updateGbpAddress(input: unknown): Promise<ActionResult> {
  const parsed = addressSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Podaj poprawny adres" };
  }
  return withGbpPatch(["storefrontAddress"], {
    storefrontAddress: parsed.data,
  });
}

const serviceAreaSchema = z.object({
  businessType: z.enum([
    "CUSTOMER_AND_BUSINESS_LOCATION",
    "CUSTOMER_LOCATION_ONLY",
    "BUSINESS_LOCATION_ONLY",
  ]),
  places: z
    .array(
      z.object({
        placeId: z.string().trim().min(1),
        placeName: z.string().trim().min(1),
      }),
    )
    .max(20)
    .optional(),
});

export async function updateGbpServiceArea(
  input: unknown,
): Promise<ActionResult> {
  const parsed = serviceAreaSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Niepoprawny obszar obsługi" };
  }
  const places =
    parsed.data.places && parsed.data.places.length > 0
      ? {
          placeInfos: parsed.data.places.map((p) => ({
            placeId: p.placeId,
            placeName: p.placeName,
          })),
        }
      : undefined;
  return withGbpPatch(["serviceArea"], {
    serviceArea: {
      businessType: parsed.data.businessType,
      places,
    },
  });
}

const placeSearchSchema = z.object({
  query: z.string().trim().min(2).max(120),
});

export async function searchServiceAreaPlaces(
  input: unknown,
): Promise<
  | { ok: true; results: Array<{ placeId: string; placeName: string }> }
  | { ok: false; error: string }
> {
  const parsed = placeSearchSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Podaj co najmniej 2 znaki" };
  }

  try {
    await getActiveProfile();
    const results = await autocompleteRegions(parsed.data.query);
    return { ok: true, results };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Nie udało się wyszukać miejsc",
    };
  }
}

const hoursPeriodSchema = z.object({
  openDay: z.string(),
  closeDay: z.string(),
  openTime: z.string(),
  closeTime: z.string(),
});

const regularHoursSchema = z.object({
  periods: z.array(hoursPeriodSchema).max(28),
});

export async function updateGbpRegularHours(
  input: unknown,
): Promise<ActionResult> {
  const parsed = regularHoursSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Niepoprawne godziny otwarcia" };
  }
  try {
    const periods = parsed.data.periods.map((p) => {
      const openTime = parseTime(p.openTime);
      const closeTime = parseTime(p.closeTime);
      if (!openTime || !closeTime) {
        throw new Error("Godziny muszą mieć format HH:MM");
      }
      return {
        openDay: p.openDay,
        closeDay: p.closeDay,
        openTime,
        closeTime,
      };
    });
    return await withGbpPatch(["regularHours"], { regularHours: { periods } });
  } catch (error) {
    return fail(error);
  }
}

const gbpDateSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
  day: z.number().int().min(1).max(31),
});

const specialHourPeriodSchema = z.object({
  startDate: gbpDateSchema,
  endDate: gbpDateSchema.optional(),
  closed: z.boolean(),
  openTime: z.string().optional(),
  closeTime: z.string().optional(),
});

const specialHoursSchema = z.object({
  periods: z.array(specialHourPeriodSchema).max(50),
});

export async function updateGbpSpecialHours(
  input: unknown,
): Promise<ActionResult> {
  const parsed = specialHoursSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Niepoprawne godziny specjalne" };
  }
  try {
    const specialHourPeriods = parsed.data.periods.map((p) => {
      const endDate = p.endDate ?? p.startDate;
      if (p.closed) {
        return {
          startDate: p.startDate,
          endDate,
          closed: true,
        };
      }
      const openTime = parseTime(p.openTime ?? "");
      const closeTime = parseTime(p.closeTime ?? "");
      if (!openTime || !closeTime) {
        throw new Error("Godziny muszą mieć format HH:MM");
      }
      return {
        startDate: p.startDate,
        endDate,
        openTime,
        closeTime,
        closed: false,
      };
    });
    return await withGbpPatch(["specialHours"], {
      specialHours: { specialHourPeriods },
    });
  } catch (error) {
    return fail(error);
  }
}

const attributeUpdateSchema = z.object({
  attributeName: z.string().min(1),
  valueType: z.enum(["BOOL", "ENUM", "REPEATED_ENUM", "URL"]),
  clear: z.boolean().optional(),
  boolValue: z.boolean().optional(),
  enumValue: z.string().optional(),
  repeatedEnum: z
    .object({
      setValues: z.array(z.string()).optional(),
      unsetValues: z.array(z.string()).optional(),
    })
    .optional(),
  uri: z.string().optional(),
});

export async function updateGbpAttribute(
  input: unknown,
): Promise<ActionResult> {
  const parsed = attributeUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Niepoprawny atrybut" };
  }

  try {
    const profile = await getActiveGbpProfile();
    const token = await getGbpAccessTokenForProfile(profile);
    const body = buildAttributeUpdateBody(parsed.data);

    await updateGbpLocationAttributes(
      token,
      profile.gbpLocationId!,
      body.attributes,
      body.attributeMask,
    );
    invalidateGbpReads();
    revalidatePath("/wizytowka", "layout");
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function updateGbpAttributesBatch(
  input: unknown,
): Promise<ActionResult> {
  const parsed = z.array(attributeUpdateSchema).min(1).safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Niepoprawne atrybuty" };
  }

  try {
    const profile = await getActiveGbpProfile();
    const token = await getGbpAccessTokenForProfile(profile);
    const attributes: Array<Record<string, unknown>> = [];
    const attributeMask: string[] = [];

    for (const item of parsed.data) {
      const body = buildAttributeUpdateBody(item);
      attributes.push(...body.attributes);
      attributeMask.push(...body.attributeMask);
    }

    await updateGbpLocationAttributes(
      token,
      profile.gbpLocationId!,
      attributes,
      attributeMask,
    );
    invalidateGbpReads();
    revalidatePath("/wizytowka", "layout");
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function reanalyzeGbpAction(): Promise<ActionResult> {
  const result = await startGbpAudit();
  invalidateGbpReads();
  revalidatePath("/wizytowka", "layout");
  return result.ok
    ? { ok: true }
    : { ok: false, error: result.error ?? "Analiza nie powiodła się" };
}

const rejectSchema = z.object({
  suggestionId: z.string().uuid(),
  reason: z.string().trim().max(500).optional(),
});

export async function rejectGbpSuggestion(
  input: unknown,
): Promise<ActionResult> {
  const parsed = rejectSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Niepoprawne dane" };
  }

  try {
    const profile = await getActiveProfile();
    const [suggestion] = await db
      .select()
      .from(gbpSuggestions)
      .where(
        and(
          eq(gbpSuggestions.id, parsed.data.suggestionId),
          eq(gbpSuggestions.profileId, profile.id),
        ),
      )
      .limit(1);

    if (!suggestion || suggestion.status !== "pending") {
      return {
        ok: false,
        error: "Propozycja nie istnieje lub jest nieaktualna",
      };
    }

    await db
      .update(gbpSuggestions)
      .set({ status: "rejected" })
      .where(eq(gbpSuggestions.id, suggestion.id));

    await appendBriefAvoid(profile.id, parsed.data.reason);

    invalidateGbpReads();

    revalidatePath("/wizytowka", "layout");
    revalidatePath("/ustawienia/kontekst");
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

const acceptSchema = z.object({
  suggestionId: z.string().uuid(),
  editedValue: z.string().optional(),
  riskAcknowledged: z.boolean().optional(),
});

export async function acceptGbpSuggestion(
  input: unknown,
): Promise<ActionResult> {
  const parsed = acceptSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Niepoprawne dane" };
  }

  try {
    const profile = await getActiveGbpProfile();
    await requireOwnedProfile(profile.id);

    const [suggestion] = await db
      .select()
      .from(gbpSuggestions)
      .where(
        and(
          eq(gbpSuggestions.id, parsed.data.suggestionId),
          eq(gbpSuggestions.profileId, profile.id),
        ),
      )
      .limit(1);

    if (!suggestion || suggestion.status !== "pending") {
      return {
        ok: false,
        error: "Propozycja nie istnieje lub jest nieaktualna",
      };
    }

    if (suggestion.risk === "high" && !parsed.data.riskAcknowledged) {
      return {
        ok: false,
        error: "Zmiana nazwy wymaga potwierdzenia ryzyka",
      };
    }

    const value =
      suggestion.field === "description"
        ? stripReviewFluffFromDescription(
            clampTextToLimit(
              parsed.data.editedValue?.trim() || suggestion.suggestedValue,
              GBP_DESCRIPTION_MAX,
            ),
          )
        : parsed.data.editedValue?.trim() || suggestion.suggestedValue;
    const token = await getGbpAccessTokenForProfile(profile);
    const locationName = profile.gbpLocationId!;
    const raw = await fetchGbpLocationDetails(token, locationName);
    const location = parseLocation(raw);

    switch (suggestion.field) {
      case "title": {
        await patchGbpLocation(token, locationName, { title: value }, [
          "title",
        ]);
        break;
      }
      case "description": {
        await patchGbpLocation(
          token,
          locationName,
          { profile: { description: value } },
          ["profile.description"],
        );
        break;
      }
      case "primary_category": {
        const additional =
          location.categories?.additionalCategories
            ?.map((c) => c.name)
            .filter((n): n is string => Boolean(n) && n !== value) ?? [];
        await patchGbpLocation(
          token,
          locationName,
          {
            categories: {
              primaryCategory: { name: value },
              additionalCategories: additional.map((name) => ({ name })),
            },
          },
          ["categories"],
        );
        break;
      }
      case "additional_categories": {
        const names = JSON.parse(value) as string[];
        if (!Array.isArray(names)) {
          return { ok: false, error: "Niepoprawna lista kategorii" };
        }
        const primary = location.categories?.primaryCategory?.name;
        if (!primary) {
          return { ok: false, error: "Brak kategorii głównej" };
        }
        await patchGbpLocation(
          token,
          locationName,
          {
            categories: {
              primaryCategory: { name: primary },
              additionalCategories: names
                .filter((n) => n !== primary)
                .map((name) => ({ name })),
            },
          },
          ["categories"],
        );
        break;
      }
      case "services": {
        if (location.metadata?.canModifyServiceList === false) {
          return {
            ok: false,
            error: "Ta lokalizacja nie pozwala edytować listy usług w Google.",
          };
        }
        const drafts = JSON.parse(value) as ServiceItemDraft[];
        if (!Array.isArray(drafts)) {
          return { ok: false, error: "Niepoprawna lista usług" };
        }
        const validated = servicesSchema.safeParse({ services: drafts });
        if (!validated.success) {
          return {
            ok: false,
            error: "Nazwa usługi max 140 znaków, opis max 250 znaków",
          };
        }
        // Full-list replace: merge is already the complete suggested list
        await patchGbpLocation(
          token,
          locationName,
          { serviceItems: draftsToServiceItems(validated.data.services) },
          ["serviceItems"],
        );
        break;
      }
      default:
        return { ok: false, error: "Nieobsługiwane pole" };
    }

    await db
      .update(gbpSuggestions)
      .set({
        status: "accepted",
        acceptedAt: new Date(),
        riskAckAt:
          suggestion.risk === "high" ? new Date() : suggestion.riskAckAt,
        suggestedValue: value,
      })
      .where(eq(gbpSuggestions.id, suggestion.id));

    invalidateGbpReads();

    revalidatePath("/wizytowka", "layout");
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function acceptAllGbpSuggestions(): Promise<
  | { ok: true; accepted: number; skippedHighRiskTitle: boolean }
  | { ok: false; error: string }
> {
  try {
    const profile = await getActiveGbpProfile();
    await requireOwnedProfile(profile.id);

    const pending = await db
      .select()
      .from(gbpSuggestions)
      .where(
        and(
          eq(gbpSuggestions.profileId, profile.id),
          eq(gbpSuggestions.status, "pending"),
        ),
      );

    const batch = pending.filter(
      (item) => !(item.field === "title" && item.risk === "high"),
    );
    const skippedHighRiskTitle = pending.some(
      (item) => item.field === "title" && item.risk === "high",
    );

    let accepted = 0;
    for (const item of batch) {
      const result = await acceptGbpSuggestion({
        suggestionId: item.id,
        riskAcknowledged: false,
      });
      if (!result.ok) {
        if (accepted === 0) {
          return { ok: false, error: result.error };
        }
        break;
      }
      accepted += 1;
    }

    invalidateGbpReads();

    revalidatePath("/wizytowka", "layout");
    return { ok: true, accepted, skippedHighRiskTitle };
  } catch (error) {
    const failed = fail(error);
    if (!failed.ok) {
      return { ok: false, error: failed.error };
    }
    return { ok: false, error: "Nie udało się zaakceptować" };
  }
}

export async function requestNapInterest(): Promise<ActionResult> {
  try {
    const profile = await getActiveProfile();
    await db.insert(napInterestRequests).values({ profileId: profile.id });
    revalidatePath("/wizytowka/nap");
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}
