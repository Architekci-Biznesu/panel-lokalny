import { and, desc, eq } from "drizzle-orm";
import {
  getActiveGbpProfile,
  getGbpAccessTokenForProfile,
  GbpNotConnectedError,
  isGbpUnauthenticatedError,
} from "@/lib/integrations/gbp/access";
import {
  batchGetGbpCategories,
  fetchGbpLocationDetails,
  getGbpLocationAttributes,
  listGbpAttributesForCategory,
  listGbpAttributesForLocation,
  type GbpAttributeMetadata,
  type GbpCategory,
} from "@/lib/integrations/gbp/client";
import { cachedGbpRead } from "@/lib/integrations/gbp/read-cache";
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

type GoogleLocationData = Pick<
  LoadedGbpBundle,
  | "location"
  | "accessToken"
  | "attributes"
  | "attributeMetadata"
  | "categoryDetails"
>;

/** Listing, categories and attributes straight from Google (no cache). */
async function fetchGoogleLocationData(
  profile: Profile,
  locationName: string,
): Promise<GoogleLocationData> {
  let accessToken = await getGbpAccessTokenForProfile(profile);

  let raw: Record<string, unknown>;
  try {
    raw = await fetchGbpLocationDetails(accessToken, locationName);
  } catch (error) {
    if (!isGbpUnauthenticatedError(error)) throw error;
    accessToken = await getGbpAccessTokenForProfile(profile, { force: true });
    try {
      raw = await fetchGbpLocationDetails(accessToken, locationName);
    } catch (retryError) {
      if (isGbpUnauthenticatedError(retryError)) {
        throw new GbpNotConnectedError(
          "Sesja Google wygasła - połącz wizytówkę ponownie",
        );
      }
      throw retryError;
    }
  }
  const location = parseLocation(raw);

  const primaryName = location.categories?.primaryCategory?.name;
  const additionalNames =
    location.categories?.additionalCategories
      ?.map((c) => c.name)
      .filter((n): n is string => Boolean(n)) ?? [];
  const categoryNames = [primaryName, ...additionalNames].filter(
    (n): n is string => Boolean(n),
  );

  const [categoryDetails, attrPayload, attributeMetadata] = await Promise.all([
    batchGetGbpCategories(accessToken, categoryNames),
    getGbpLocationAttributes(accessToken, locationName).catch(() => ({
      attributes: [] as Array<Record<string, unknown>>,
    })),
    listGbpAttributesForLocation(accessToken, locationName).catch(() =>
      primaryName
        ? listGbpAttributesForCategory(accessToken, primaryName).catch(
            () => [] as GbpAttributeMetadata[],
          )
        : Promise.resolve([] as GbpAttributeMetadata[]),
    ),
  ]);

  return {
    location,
    accessToken,
    attributes: attrPayload.attributes ?? [],
    attributeMetadata,
    categoryDetails,
  };
}

/**
 * Active profile's listing for the panel pages. Google data comes from the
 * short read cache (see read-cache.ts); suggestions and audit runs always
 * from the database, in parallel with Google.
 */
export async function loadActiveGbpBundle(): Promise<LoadedGbpBundle> {
  const profile = await getActiveGbpProfile();
  const locationName = profile.gbpLocationId!;

  const [google, pendingSuggestions, latestRuns] = await Promise.all([
    cachedGbpRead(profile.id, `location:${locationName}`, () =>
      fetchGoogleLocationData(profile, locationName),
    ),
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
    ...google,
    profile,
    locationName,
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
}

export async function tryLoadActiveGbpBundle(): Promise<LoadedGbpBundle | null> {
  try {
    return await loadActiveGbpBundle();
  } catch {
    return null;
  }
}
