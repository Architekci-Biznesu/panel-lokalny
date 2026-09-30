import type { GbpSnapshotKind, Profile } from "@/lib/db/schema";
import {
  batchGetGbpCategories,
  fetchGbpLocationDetails,
  fetchGbpMultiDailyMetrics,
  getGbpLocationAttributes,
  listGbpAttributesForCategory,
  listGbpCategories,
  listGbpLocationMedia,
  type GbpAttributeMetadata,
  type GbpCategory,
  type GbpLocationMedia,
} from "@/lib/integrations/gbp/client";
import {
  GbpNotConnectedError,
  isGbpUnauthenticatedError,
} from "@/lib/integrations/gbp/errors";
import { getGbpAccessTokenForProfile } from "@/lib/integrations/gbp/token";
import { withGbpV4LocationName } from "@/lib/integrations/gbp/v4-name";
import type { SnapshotTarget } from "@/lib/integrations/gbp/snapshots/store";
import {
  ALL_PERFORMANCE_METRICS,
  defaultRange,
  formatDateIso,
  fromDateParts,
  IMPRESSION_METRICS,
  parseDateIso,
  toDateParts,
  type DateParts,
} from "@/features/wizytowka/performance";

/**
 * What each snapshot holds and how to fetch it from Google. Everything is
 * rebuilt from (kind, key) alone, so the background refresh needs only the
 * row. No session and no next/* here.
 */

/** Listing as Google returns it (no access token - that never goes to the database). */
export type LocationSnapshot = {
  raw: Record<string, unknown>;
  attributes: Array<Record<string, unknown>>;
  /** Primary and additional categories with their service types. */
  categoryDetails: GbpCategory[];
};

export type MetricsSnapshot = {
  /** Dates the data was actually fetched for - a rolling range moves every day. */
  start: DateParts;
  end: DateParts;
  payload: unknown;
};

export type SnapshotData = {
  location: LocationSnapshot;
  media: GbpLocationMedia;
  metrics: MetricsSnapshot;
  categories: GbpCategory[];
  attribute_metadata: GbpAttributeMetadata[];
};

export const CATEGORIES_KEY = "PL:pl";

/** Rolling ranges are named, not dated - otherwise the key changes at midnight and the first visit of every day waits for Google. */
export type RollingMetricsRange = "last30" | "last30-prev-year";

export function metricsKey(
  locationName: string,
  range: RollingMetricsRange | { start: DateParts; end: DateParts },
): string {
  if (typeof range === "string") return `${locationName}:${range}`;
  return `${locationName}:${formatDateIso(range.start)}_${formatDateIso(range.end)}`;
}

export function attributeMetadataKey(categoryName: string): string {
  return `${categoryName}:PL`;
}

function splitKey(key: string): [string, string] {
  const at = key.lastIndexOf(":");
  return [key.slice(0, at), key.slice(at + 1)];
}

/** Metric set and dates behind a metrics key, as of today. */
export function metricsRequest(key: string): {
  locationName: string;
  metrics: typeof ALL_PERFORMANCE_METRICS;
  start: DateParts;
  end: DateParts;
} {
  const [locationName, range] = splitKey(key);
  const last30 = defaultRange();

  if (range === "last30") {
    return { locationName, metrics: ALL_PERFORMANCE_METRICS, ...last30 };
  }
  if (range === "last30-prev-year") {
    // Same calendar month a year earlier, up to the same day (month-to-date).
    const end = fromDateParts(last30.end);
    return {
      locationName,
      metrics: IMPRESSION_METRICS,
      start: toDateParts(new Date(end.getFullYear() - 1, end.getMonth(), 1)),
      end: toDateParts(
        new Date(end.getFullYear() - 1, end.getMonth(), end.getDate()),
      ),
    };
  }

  const [from, to] = range.split("_");
  const start = parseDateIso(from);
  const endParts = parseDateIso(to);
  if (!start || !endParts)
    throw new Error(`Nieprawidłowy klucz statystyk: ${key}`);
  return {
    locationName,
    metrics: ALL_PERFORMANCE_METRICS,
    start,
    end: endParts,
  };
}

function categoryNamesOf(raw: Record<string, unknown>): string[] {
  const categories = raw.categories as
    | {
        primaryCategory?: { name?: string };
        additionalCategories?: Array<{ name?: string }>;
      }
    | undefined;
  return [
    categories?.primaryCategory?.name,
    ...(categories?.additionalCategories?.map((c) => c.name) ?? []),
  ].filter((n): n is string => Boolean(n));
}

/** Location snapshot built from a listing Google just returned (after a read or a PATCH). */
export async function buildLocationSnapshot(
  accessToken: string,
  locationName: string,
  raw: Record<string, unknown>,
  previous?: LocationSnapshot | null,
): Promise<LocationSnapshot> {
  const names = categoryNamesOf(raw);
  const known = new Map(
    (previous?.categoryDetails ?? []).map((c) => [c.name, c]),
  );
  const missing = names.filter((n) => !known.has(n));

  const [fetched, attributes] = await Promise.all([
    batchGetGbpCategories(accessToken, missing),
    previous
      ? Promise.resolve({ attributes: previous.attributes })
      : getGbpLocationAttributes(accessToken, locationName).catch(() => ({
          attributes: [] as Array<Record<string, unknown>>,
        })),
  ]);
  for (const c of fetched) known.set(c.name, c);

  return {
    raw,
    attributes: attributes.attributes ?? [],
    categoryDetails: names
      .map((n) => known.get(n))
      .filter((c): c is GbpCategory => Boolean(c)),
  };
}

async function fetchKind(
  profile: Profile,
  accessToken: string,
  kind: GbpSnapshotKind,
  key: string,
): Promise<unknown> {
  switch (kind) {
    case "location": {
      const raw = await fetchGbpLocationDetails(accessToken, key);
      return buildLocationSnapshot(accessToken, key, raw);
    }
    case "media":
      return withGbpV4LocationName(profile, accessToken, (v4) =>
        listGbpLocationMedia(accessToken, v4),
      );
    case "metrics": {
      const request = metricsRequest(key);
      const payload = await fetchGbpMultiDailyMetrics(
        accessToken,
        request.locationName,
        request.metrics,
        request.start,
        request.end,
      );
      return {
        start: request.start,
        end: request.end,
        payload,
      } satisfies MetricsSnapshot;
    }
    case "categories":
      return listGbpCategories(accessToken);
    case "attribute_metadata":
      return listGbpAttributesForCategory(accessToken, splitKey(key)[0]);
  }
}

/**
 * Fetches one snapshot's data with the profile's token (one forced token
 * refresh when Google says it is stale). Shared dictionaries use the token of
 * whichever profile asked - their content does not depend on it.
 */
export async function fetchSnapshotData(
  profile: Profile,
  target: SnapshotTarget,
): Promise<unknown> {
  if (target.profileId !== null && target.profileId !== profile.id) {
    throw new Error("Migawka nie należy do tego profilu");
  }
  let token = await getGbpAccessTokenForProfile(profile);
  try {
    return await fetchKind(profile, token, target.kind, target.key);
  } catch (error) {
    if (!isGbpUnauthenticatedError(error)) throw error;
    token = await getGbpAccessTokenForProfile(profile, { force: true });
    try {
      return await fetchKind(profile, token, target.kind, target.key);
    } catch (retryError) {
      if (isGbpUnauthenticatedError(retryError)) {
        throw new GbpNotConnectedError(
          "Sesja Google wygasła - połącz wizytówkę ponownie",
        );
      }
      throw retryError;
    }
  }
}
