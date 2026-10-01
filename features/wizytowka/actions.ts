"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
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
  fetchGbpGoogleUpdated,
  fetchGbpLocationDetails,
  patchGbpLocation,
  updateGbpLocationAttributes,
} from "@/lib/integrations/gbp/client";
import { autocompleteRegions } from "@/lib/integrations/places/client";
import { getActiveProfile, requireOwnedProfile } from "@/lib/session";
import { parseLocation } from "@/features/wizytowka/types";
import {
  GOOGLE_FIELD_PATHS,
  patchForField,
  type GoogleField,
} from "@/features/wizytowka/google-updates";
import {
  listFingerprint,
  WHOLE_LIST_CONFLICT_MESSAGES,
  type WholeListField,
} from "@/features/wizytowka/fingerprint";
import {
  saveAttributesAfterPatch,
  saveFreshLocation,
  saveLocationAfterPatch,
} from "@/features/wizytowka/snapshots/after-write";

type ActionResult =
  | { ok: true }
  | {
      ok: false;
      error: string;
      /** Google changed the edited list since the editor opened - nothing was saved. */
      conflict?: boolean;
    };

function fail(error: unknown): ActionResult {
  if (error instanceof GbpNotConnectedError) {
    return { ok: false, error: error.message };
  }
  return {
    ok: false,
    error: error instanceof Error ? error.message : "Nie udało się zapisać",
  };
}

/** Editor's fingerprint of a whole-list field, taken when it opened. */
type ListGuard = { field: WholeListField; fingerprint: string };

/**
 * Saves a field to Google and puts Google's answer into the snapshot. A
 * whole-list field is saved only if Google still has what the editor showed
 * (fingerprint); otherwise nothing is written and the snapshot gets the newer
 * list.
 */
async function withGbpPatch(
  updateMask: string[],
  body: Record<string, unknown>,
  guard?: ListGuard,
): Promise<ActionResult> {
  try {
    const profile = await getActiveGbpProfile();
    const token = await getGbpAccessTokenForProfile(profile);
    const locationName = profile.gbpLocationId!;

    let freshBase: Record<string, unknown> | null = null;
    if (guard) {
      freshBase = await fetchGbpLocationDetails(token, locationName);
      const conflict = await rejectIfChanged(profile, token, freshBase, guard);
      if (conflict) return conflict;
    }

    const response = await patchGbpLocation(
      token,
      locationName,
      body,
      updateMask,
    );
    await saveLocationAfterPatch(profile, token, {
      body,
      updateMask,
      response,
      freshBase,
    });
    revalidatePath("/wizytowka", "layout");
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

/** Conflict result (and a snapshot with Google's newer data) when the list changed. */
async function rejectIfChanged(
  profile: Awaited<ReturnType<typeof getActiveGbpProfile>>,
  token: string,
  freshRaw: Record<string, unknown>,
  guard: ListGuard,
): Promise<ActionResult | null> {
  const current = listFingerprint(parseLocation(freshRaw), guard.field);
  if (current === guard.fingerprint) return null;
  await saveFreshLocation(profile, token, freshRaw);
  revalidatePath("/wizytowka", "layout");
  return {
    ok: false,
    error: WHOLE_LIST_CONFLICT_MESSAGES[guard.field],
    conflict: true,
  };
}

const fingerprintField = z.string().trim().min(1).max(64);

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
  fingerprint: fingerprintField,
});

export async function updateGbpCategories(
  input: unknown,
): Promise<ActionResult> {
  const parsed = categoriesSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Wybierz kategorie ze słownika Google" };
  }
  const { primaryCategoryName, additionalCategoryNames, fingerprint } =
    parsed.data;
  return withGbpPatch(
    ["categories"],
    {
      categories: {
        primaryCategory: { name: primaryCategoryName },
        additionalCategories: additionalCategoryNames.map((name) => ({ name })),
      },
    },
    { field: "categories", fingerprint },
  );
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

const servicesSaveSchema = servicesSchema.extend({
  fingerprint: fingerprintField,
});

export async function updateGbpServices(input: unknown): Promise<ActionResult> {
  const parsed = servicesSaveSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Nazwa usługi max 140 znaków, opis max 250 znaków",
    };
  }

  try {
    const profile = await getActiveGbpProfile();
    const token = await getGbpAccessTokenForProfile(profile);
    const locationName = profile.gbpLocationId!;
    const raw = await fetchGbpLocationDetails(token, locationName);
    const location = parseLocation(raw);

    if (location.metadata?.canModifyServiceList === false) {
      return {
        ok: false,
        error:
          "Ta lokalizacja nie pozwala edytować listy usług w Google (canModifyServiceList).",
      };
    }

    const conflict = await rejectIfChanged(profile, token, raw, {
      field: "serviceItems",
      fingerprint: parsed.data.fingerprint,
    });
    if (conflict) return conflict;

    const drafts = parsed.data.services as ServiceItemDraft[];
    const body = { serviceItems: draftsToServiceItems(drafts) };
    const response = await patchGbpLocation(token, locationName, body, [
      "serviceItems",
    ]);
    await saveLocationAfterPatch(profile, token, {
      body,
      updateMask: ["serviceItems"],
      response,
      freshBase: raw,
    });
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
  fingerprint: fingerprintField,
});

export async function updateGbpPhones(input: unknown): Promise<ActionResult> {
  const parsed = phoneSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Podaj poprawny numer telefonu" };
  }
  return withGbpPatch(
    ["phoneNumbers"],
    {
      phoneNumbers: {
        primaryPhone: parsed.data.primaryPhone,
        additionalPhones: parsed.data.additionalPhones,
      },
    },
    { field: "phoneNumbers", fingerprint: parsed.data.fingerprint },
  );
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
  fingerprint: fingerprintField,
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
  return withGbpPatch(
    ["serviceArea"],
    {
      serviceArea: {
        businessType: parsed.data.businessType,
        places,
      },
    },
    { field: "serviceArea", fingerprint: parsed.data.fingerprint },
  );
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
  fingerprint: fingerprintField,
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
    return await withGbpPatch(
      ["regularHours"],
      { regularHours: { periods } },
      { field: "regularHours", fingerprint: parsed.data.fingerprint },
    );
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
  fingerprint: fingerprintField,
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
    return await withGbpPatch(
      ["specialHours"],
      { specialHours: { specialHourPeriods } },
      { field: "specialHours", fingerprint: parsed.data.fingerprint },
    );
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

    const response = await updateGbpLocationAttributes(
      token,
      profile.gbpLocationId!,
      body.attributes,
      body.attributeMask,
    );
    await saveAttributesAfterPatch(profile, token, {
      sent: body.attributes,
      attributeMask: body.attributeMask,
      response,
    });
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

    const response = await updateGbpLocationAttributes(
      token,
      profile.gbpLocationId!,
      attributes,
      attributeMask,
    );
    await saveAttributesAfterPatch(profile, token, {
      sent: attributes,
      attributeMask,
      response,
    });
    revalidatePath("/wizytowka", "layout");
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function reanalyzeGbpAction(): Promise<ActionResult> {
  const result = await startGbpAudit();
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

    let body: Record<string, unknown>;
    let updateMask: string[];
    switch (suggestion.field) {
      case "title": {
        body = { title: value };
        updateMask = ["title"];
        break;
      }
      case "description": {
        body = { profile: { description: value } };
        updateMask = ["profile.description"];
        break;
      }
      case "primary_category": {
        const additional =
          location.categories?.additionalCategories
            ?.map((c) => c.name)
            .filter((n): n is string => Boolean(n) && n !== value) ?? [];
        body = {
          categories: {
            primaryCategory: { name: value },
            additionalCategories: additional.map((name) => ({ name })),
          },
        };
        updateMask = ["categories"];
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
        body = {
          categories: {
            primaryCategory: { name: primary },
            additionalCategories: names
              .filter((n) => n !== primary)
              .map((name) => ({ name })),
          },
        };
        updateMask = ["categories"];
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
        body = { serviceItems: draftsToServiceItems(validated.data.services) };
        updateMask = ["serviceItems"];
        break;
      }
      default:
        return { ok: false, error: "Nieobsługiwane pole" };
    }

    const response = await patchGbpLocation(
      token,
      locationName,
      body,
      updateMask,
    );
    await saveLocationAfterPatch(profile, token, {
      body,
      updateMask,
      response,
      freshBase: raw,
    });

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

const googleChangeSchema = z.object({
  field: z.enum(
    Object.keys(GOOGLE_FIELD_PATHS) as [GoogleField, ...GoogleField[]],
  ),
  choice: z.enum(["google", "own"]),
});

/**
 * A field Google changed: take Google's version as the owner's, or send the
 * owner's version again. Both values are read fresh from Google here - never
 * from the browser.
 */
export async function resolveGoogleChange(
  input: unknown,
): Promise<ActionResult> {
  const parsed = googleChangeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Niepoprawne dane" };
  const { field, choice } = parsed.data;

  try {
    const profile = await getActiveGbpProfile();
    const token = await getGbpAccessTokenForProfile(profile);
    const locationName = profile.gbpLocationId!;
    const [own, google] = await Promise.all([
      fetchGbpLocationDetails(token, locationName),
      fetchGbpGoogleUpdated(token, locationName),
    ]);

    const changed = google.diffMask.some(
      (path) => path.split(".")[0] === GOOGLE_FIELD_PATHS[field].top,
    );
    if (!changed) {
      await saveFreshLocation(profile, token, own);
      revalidatePath("/wizytowka", "layout");
      return {
        ok: false,
        error: "Google pokazuje już Twoją wersję - odświeżyliśmy dane",
      };
    }

    const { body, updateMask } = patchForField(
      field,
      choice === "google" ? google.location : own,
    );
    const response = await patchGbpLocation(
      token,
      locationName,
      body,
      updateMask,
    );
    await saveLocationAfterPatch(profile, token, {
      body,
      updateMask,
      response,
      freshBase: own,
    });
    revalidatePath("/wizytowka", "layout");
    return { ok: true };
  } catch (error) {
    return fail(error);
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
