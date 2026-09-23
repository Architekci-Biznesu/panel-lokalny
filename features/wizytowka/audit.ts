import { and, desc, eq, inArray } from "drizzle-orm";
import { getTextProvider } from "@/lib/ai";
import {
  GBP_DESCRIPTION_MAX,
  GBP_SERVICE_DESC_MAX,
  GBP_SERVICE_NAME_MAX,
  clampTextToLimit,
} from "@/lib/ai/gbp-limits";
import { db } from "@/lib/db";
import {
  companyContext,
  gbpAuditRuns,
  gbpSuggestions,
  profileBriefs,
  type Profile,
} from "@/lib/db/schema";
import {
  batchGetGbpCategories,
  fetchGbpLocationDetails,
  listGbpAttributesForCategory,
  listGbpAttributesForLocation,
  listGbpCategories,
} from "@/lib/integrations/gbp/client";
import { getGbpAccessTokenForProfile } from "@/lib/integrations/gbp/access";
import { requireOwnedProfile } from "@/lib/session";
import { parseLocation, serviceItemsToDrafts } from "@/features/wizytowka/types";

function normalizeSuggestionValue(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function parseJsonNames(value: string): string[] | null {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return null;
    if (parsed.some((item) => typeof item !== "string")) return null;
    return parsed as string[];
  } catch {
    return null;
  }
}

function serviceDraftFingerprint(item: {
  kind?: string;
  serviceTypeId?: string;
  displayName?: string;
  description?: string;
}): string {
  return [
    item.kind ?? "",
    item.serviceTypeId ?? "",
    (item.displayName ?? "").trim(),
    (item.description ?? "").trim(),
  ]
    .join("|")
    .toLowerCase();
}

function servicesFingerprint(value: string): string | null {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return null;
    const drafts = parsed.some(
      (item) =>
        item &&
        typeof item === "object" &&
        ("structuredServiceItem" in item || "freeFormServiceItem" in item),
    )
      ? serviceItemsToDrafts(parsed as Parameters<typeof serviceItemsToDrafts>[0])
      : (parsed as Array<{
          kind?: string;
          serviceTypeId?: string;
          displayName?: string;
          description?: string;
        }>);
    return drafts
      .map((item) => serviceDraftFingerprint(item))
      .sort()
      .join("\n");
  } catch {
    return null;
  }
}

/** True when suggested content matches the live location (no real change). */
function isNoopSuggestion(
  field: string,
  current: string | null,
  suggested: string,
): boolean {
  if (current == null) return false;

  if (
    field === "title" ||
    field === "description" ||
    field === "primary_category"
  ) {
    return (
      normalizeSuggestionValue(current) === normalizeSuggestionValue(suggested)
    );
  }

  if (field === "additional_categories") {
    const a = parseJsonNames(current);
    const b = parseJsonNames(suggested);
    if (!a || !b) return false;
    if (a.length !== b.length) return false;
    const left = [...a].sort().join("\n");
    const right = [...b].sort().join("\n");
    return left === right;
  }

  if (field === "services") {
    const left = servicesFingerprint(current);
    const right = servicesFingerprint(suggested);
    if (left == null || right == null) return false;
    return left === right;
  }

  return normalizeSuggestionValue(current) === normalizeSuggestionValue(suggested);
}

function currentValueForField(
  location: ReturnType<typeof parseLocation>,
  field: string,
): string | null {
  switch (field) {
    case "title":
      return location.title ?? null;
    case "description":
      return location.profile?.description ?? null;
    case "primary_category":
      return location.categories?.primaryCategory?.name ?? null;
    case "additional_categories":
      return JSON.stringify(
        (location.categories?.additionalCategories ?? [])
          .map((c) => c.name)
          .filter(Boolean),
      );
    case "services":
      return JSON.stringify(location.serviceItems ?? []);
    default:
      return null;
  }
}

async function loadBrief(profileId: string) {
  const [brief] = await db
    .select()
    .from(profileBriefs)
    .where(eq(profileBriefs.profileId, profileId))
    .limit(1);
  return brief;
}

async function loadContexts(profileId: string) {
  const rows = await db
    .select()
    .from(companyContext)
    .where(eq(companyContext.profileId, profileId))
    .orderBy(desc(companyContext.fetchedAt));

  let website: string | null = null;
  let gbp: string | null = null;
  for (const row of rows) {
    const text =
      typeof row.rawData === "string"
        ? row.rawData
        : JSON.stringify(row.rawData);
    if (row.source === "website" && !website) website = text;
    if (row.source === "gbp" && !gbp) gbp = text;
  }
  return { website, gbp };
}

export async function runGbpAuditForProfile(profileId: string): Promise<void> {
  // TODO: przenieść do kolejki BullMQ (Faza 5)
  const profile = await requireOwnedProfile(profileId);
  if (!profile.gbpLocationId || !profile.oauthConnectionId) {
    return;
  }

  const [run] = await db
    .insert(gbpAuditRuns)
    .values({ profileId: profile.id, status: "running" })
    .returning();

  try {
    await executeAudit(profile);
    await db
      .update(gbpAuditRuns)
      .set({ status: "done", finishedAt: new Date() })
      .where(eq(gbpAuditRuns.id, run.id));
  } catch (error) {
    await db
      .update(gbpAuditRuns)
      .set({
        status: "failed",
        error: error instanceof Error ? error.message : "Nieznany błąd",
        finishedAt: new Date(),
      })
      .where(eq(gbpAuditRuns.id, run.id));
    throw error;
  }
}

async function executeAudit(profile: Profile): Promise<void> {
  const accessToken = await getGbpAccessTokenForProfile(profile);
  const locationName = profile.gbpLocationId!;
  const raw = await fetchGbpLocationDetails(accessToken, locationName);
  const location = parseLocation(raw);

  const brief = await loadBrief(profile.id);
  const contexts = await loadContexts(profile.id);

  const primaryName = location.categories?.primaryCategory?.name;
  const categoryNames = [
    primaryName,
    ...(location.categories?.additionalCategories?.map((c) => c.name) ?? []),
  ].filter((n): n is string => Boolean(n));

  const [allCategories, categoryDetails, attributeMetadata, rejected] =
    await Promise.all([
      listGbpCategories(accessToken).catch(() => []),
      batchGetGbpCategories(accessToken, categoryNames),
      listGbpAttributesForLocation(accessToken, locationName).catch(() =>
        primaryName
          ? listGbpAttributesForCategory(accessToken, primaryName).catch(
              () => [],
            )
          : Promise.resolve([]),
      ),
      db
        .select({
          field: gbpSuggestions.field,
          suggestedValue: gbpSuggestions.suggestedValue,
        })
        .from(gbpSuggestions)
        .where(
          and(
            eq(gbpSuggestions.profileId, profile.id),
            eq(gbpSuggestions.status, "rejected"),
          ),
        ),
    ]);

  const serviceTypes = categoryDetails.flatMap((c) => c.serviceTypes ?? []);

  const availableCategories =
    allCategories.length > 0
      ? allCategories.map((c) => ({ name: c.name, displayName: c.displayName }))
      : categoryDetails.map((c) => ({
          name: c.name,
          displayName: c.displayName,
        }));

  const provider = getTextProvider();
  const suggestions = await provider.generateGbpAuditSuggestions({
    brief: {
      services: brief?.services ?? "",
      tone: brief?.tone ?? "",
      targetAudience: brief?.targetAudience ?? "",
      differentiators: brief?.differentiators ?? "",
      serviceArea: brief?.serviceArea,
      avoid: brief?.avoid,
      outOfScope: brief?.outOfScope,
      websiteUrl: brief?.websiteUrl,
      notes: brief?.notes,
    },
    websiteContext: contexts.website,
    gbpContext: contexts.gbp,
    locationSnapshot: JSON.stringify({
      title: location.title,
      description: location.profile?.description,
      categories: location.categories,
      serviceItems: location.serviceItems,
      openInfo: location.openInfo,
      websiteUri: location.websiteUri,
      phoneNumbers: location.phoneNumbers,
      storefrontAddress: location.storefrontAddress,
    }),
    availableCategories,
    serviceTypes,
    availableAttributes: attributeMetadata.map((a) => ({
      parent: a.parent,
      displayName: a.displayName,
    })),
    rejectedSuggestions: rejected,
  });

  const rejectedSet = new Set(
    rejected.map(
      (r) => `${r.field}::${normalizeSuggestionValue(r.suggestedValue)}`,
    ),
  );

  const pending = await db
    .select({ id: gbpSuggestions.id })
    .from(gbpSuggestions)
    .where(
      and(
        eq(gbpSuggestions.profileId, profile.id),
        eq(gbpSuggestions.status, "pending"),
      ),
    );

  if (pending.length > 0) {
    await db
      .update(gbpSuggestions)
      .set({ status: "superseded" })
      .where(
        inArray(
          gbpSuggestions.id,
          pending.map((p) => p.id),
        ),
      );
  }

  const categoryNameSet = new Set(availableCategories.map((c) => c.name));
  const serviceTypeSet = new Set(serviceTypes.map((s) => s.serviceTypeId));

  for (const suggestion of suggestions) {
    let suggestedValue = suggestion.suggestedValue;
    if (suggestion.field === "description") {
      suggestedValue = clampTextToLimit(suggestedValue, GBP_DESCRIPTION_MAX);
    }

    const key = `${suggestion.field}::${normalizeSuggestionValue(suggestedValue)}`;
    if (rejectedSet.has(key)) continue;
    if (!suggestedValue) continue;

    if (
      suggestion.field === "primary_category" &&
      !categoryNameSet.has(suggestedValue)
    ) {
      continue;
    }

    if (suggestion.field === "additional_categories") {
      try {
        const names = JSON.parse(suggestedValue) as unknown;
        if (
          !Array.isArray(names) ||
          names.some((n) => typeof n !== "string" || !categoryNameSet.has(n))
        ) {
          continue;
        }
      } catch {
        continue;
      }
    }

    if (suggestion.field === "services") {
      try {
        const items = JSON.parse(suggestedValue) as Array<{
          kind?: string;
          serviceTypeId?: string;
          displayName?: string;
          description?: string;
        }>;
        if (!Array.isArray(items)) continue;
        const currentCount = (location.serviceItems ?? []).length;
        if (currentCount > 0 && items.length < currentCount) {
          continue;
        }
        const invalid = items.some((item) => {
          if (item.kind === "structured") {
            return !item.serviceTypeId || !serviceTypeSet.has(item.serviceTypeId);
          }
          const name = item.displayName ?? "";
          const desc = item.description ?? "";
          return (
            name.length > GBP_SERVICE_NAME_MAX ||
            desc.length > GBP_SERVICE_DESC_MAX
          );
        });
        if (invalid) continue;
      } catch {
        continue;
      }
    }

    const currentValue = currentValueForField(location, suggestion.field);
    if (isNoopSuggestion(suggestion.field, currentValue, suggestedValue)) {
      continue;
    }

    await db.insert(gbpSuggestions).values({
      profileId: profile.id,
      field: suggestion.field,
      currentValue,
      suggestedValue,
      rationale: suggestion.rationale || null,
      risk: suggestion.field === "title" ? "high" : "none",
      status: "pending",
    });
  }
}

/** Starts audit for active profile (or given owned profileId). */
export async function startGbpAudit(profileId?: string): Promise<{
  ok: boolean;
  error?: string;
}> {
  try {
    let id = profileId;
    if (!id) {
      const { getActiveProfile } = await import("@/lib/session");
      id = (await getActiveProfile()).id;
    } else {
      await requireOwnedProfile(id);
    }
    await runGbpAuditForProfile(id);
    return { ok: true };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Analiza nie powiodła się";
    const friendly =
      message.includes("invalid_type") || message.includes("expected string")
        ? "Model AI zwrócił niepoprawny format propozycji. Spróbuj ponownie."
        : message;
    return {
      ok: false,
      error: friendly,
    };
  }
}
