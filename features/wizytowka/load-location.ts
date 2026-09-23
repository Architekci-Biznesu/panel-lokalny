import { and, desc, eq } from "drizzle-orm";
import {
  getActiveGbpProfile,
  getGbpAccessTokenForProfile,
} from "@/lib/integrations/gbp/access";
import {
  batchGetGbpCategories,
  fetchGbpLocationDetails,
  getGbpLocationAttributes,
  listGbpAttributesForCategory,
  type GbpAttributeMetadata,
  type GbpCategory,
} from "@/lib/integrations/gbp/client";
import { db } from "@/lib/db";
import {
  gbpAuditRuns,
  gbpSuggestions,
  type GbpAuditRun,
  type GbpSuggestion,
  type Profile,
} from "@/lib/db/schema";
import { parseLocation, type GbpLocation } from "@/features/wizytowka/types";

export type LoadedGbpBundle = {
  profile: Profile;
  location: GbpLocation;
  locationName: string;
  accessToken: string;
  attributes: Array<Record<string, unknown>>;
  attributeMetadata: GbpAttributeMetadata[];
  categoryDetails: GbpCategory[];
  pendingSuggestions: GbpSuggestion[];
  latestAuditRun: GbpAuditRun | null;
};

export async function loadActiveGbpBundle(): Promise<LoadedGbpBundle> {
  const profile = await getActiveGbpProfile();
  const accessToken = await getGbpAccessTokenForProfile(profile);
  const locationName = profile.gbpLocationId!;

  const raw = await fetchGbpLocationDetails(accessToken, locationName);
  const location = parseLocation(raw);

  const primaryName = location.categories?.primaryCategory?.name;
  const additionalNames =
    location.categories?.additionalCategories
      ?.map((c) => c.name)
      .filter((n): n is string => Boolean(n)) ?? [];
  const categoryNames = [primaryName, ...additionalNames].filter(
    (n): n is string => Boolean(n),
  );

  const [categoryDetails, attrPayload, attributeMetadata, pendingSuggestions, latestRuns] =
    await Promise.all([
      batchGetGbpCategories(accessToken, categoryNames),
      getGbpLocationAttributes(accessToken, locationName).catch(() => ({
        attributes: [] as Array<Record<string, unknown>>,
      })),
      primaryName
        ? listGbpAttributesForCategory(accessToken, primaryName).catch(
            () => [] as GbpAttributeMetadata[],
          )
        : Promise.resolve([] as GbpAttributeMetadata[]),
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

  return {
    profile,
    location,
    locationName,
    accessToken,
    attributes: attrPayload.attributes ?? [],
    attributeMetadata,
    categoryDetails,
    pendingSuggestions,
    latestAuditRun: latestRuns[0] ?? null,
  };
}

export async function tryLoadActiveGbpBundle(): Promise<LoadedGbpBundle | null> {
  try {
    return await loadActiveGbpBundle();
  } catch {
    return null;
  }
}
