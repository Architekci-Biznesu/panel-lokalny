import { cache } from "react";
import { and, desc, eq } from "drizzle-orm";
import { getActiveGbpProfile } from "@/lib/integrations/gbp/access";
import type {
  GbpAttributeMetadata,
  GbpCategory,
  GbpLocationMedia,
} from "@/lib/integrations/gbp/client";
import { db } from "@/lib/db";
import {
  gbpAuditRuns,
  gbpSuggestions,
  type GbpAuditRun,
  type GbpSuggestion,
  type Profile,
} from "@/lib/db/schema";
import { GBP_DESCRIPTION_MAX, clampTextToLimit } from "@/lib/ai/gbp-limits";
import { parseLocation, type GbpLocation } from "@/features/wizytowka/types";
import { readGbpSnapshot } from "@/features/wizytowka/snapshots/read";
import {
  attributeMetadataKey,
  CATEGORIES_KEY,
} from "@/features/wizytowka/snapshots/sources";

export type LoadedGbpBundle = {
  profile: Profile;
  location: GbpLocation;
  locationName: string;
  attributes: Array<Record<string, unknown>>;
  attributeMetadata: GbpAttributeMetadata[];
  categoryDetails: GbpCategory[];
  pendingSuggestions: GbpSuggestion[];
  latestAuditRun: GbpAuditRun | null;
  /** When the listing snapshot was read from Google. */
  fetchedAt: Date;
};

/** Attribute dictionary of the primary category (shared by all profiles). */
async function loadAttributeMetadata(
  profile: Profile,
  primaryCategory: string | undefined,
): Promise<GbpAttributeMetadata[]> {
  if (!primaryCategory) return [];
  try {
    const read = await readGbpSnapshot(
      profile,
      "attribute_metadata",
      attributeMetadataKey(primaryCategory),
    );
    return read.data;
  } catch (error) {
    console.error("GBP attribute metadata failed:", error);
    return [];
  }
}

/**
 * Active profile's listing for the panel pages. Google data comes from the
 * snapshot in the database (see snapshots/read.ts); suggestions and audit runs
 * always from the database. One load per request - the layout and the tab
 * page share it.
 */
export const loadActiveGbpBundle = cache(async (): Promise<LoadedGbpBundle> => {
  const profile = await getActiveGbpProfile();
  const locationName = profile.gbpLocationId!;

  const [snapshot, pendingSuggestions, latestRuns] = await Promise.all([
    readGbpSnapshot(profile, "location", locationName),
    db
      .select()
      .from(gbpSuggestions)
      .where(
        and(
          eq(gbpSuggestions.profileId, profile.id),
          eq(gbpSuggestions.status, "pending"),
        ),
      )
      .orderBy(desc(gbpSuggestions.createdAt)),
    db
      .select()
      .from(gbpAuditRuns)
      .where(eq(gbpAuditRuns.profileId, profile.id))
      .orderBy(desc(gbpAuditRuns.startedAt))
      .limit(1),
  ]);

  const location = parseLocation(snapshot.data.raw);
  const attributeMetadata = await loadAttributeMetadata(
    profile,
    location.categories?.primaryCategory?.name,
  );

  return {
    profile,
    location,
    locationName,
    attributes: snapshot.data.attributes,
    attributeMetadata,
    categoryDetails: snapshot.data.categoryDetails,
    fetchedAt: snapshot.fetchedAt,
    pendingSuggestions: pendingSuggestions.map((s) =>
      s.field === "description"
        ? {
            ...s,
            suggestedValue: clampTextToLimit(
              s.suggestedValue,
              GBP_DESCRIPTION_MAX,
            ),
          }
        : s,
    ),
    latestAuditRun: latestRuns[0] ?? null,
  };
});

export async function tryLoadActiveGbpBundle(): Promise<LoadedGbpBundle | null> {
  try {
    return await loadActiveGbpBundle();
  } catch {
    return null;
  }
}

/** Owner and customer photos from the media snapshot (empty when Google refuses). */
export async function loadGbpMedia(
  profile: Profile,
): Promise<GbpLocationMedia> {
  try {
    const read = await readGbpSnapshot(
      profile,
      "media",
      profile.gbpLocationId!,
    );
    return read.data;
  } catch (error) {
    console.error("GBP media failed:", error);
    return { owner: [], customers: [] };
  }
}

/** The whole PL category dictionary - shared snapshot, names only for pickers. */
export async function loadCategoryOptions(
  profile: Profile,
  fallback: GbpCategory[],
): Promise<Array<{ name: string; displayName: string }>> {
  try {
    const read = await readGbpSnapshot(profile, "categories", CATEGORIES_KEY);
    return read.data.map((c) => ({ name: c.name, displayName: c.displayName }));
  } catch (error) {
    console.error("GBP categories failed:", error);
    return fallback.map((c) => ({ name: c.name, displayName: c.displayName }));
  }
}
