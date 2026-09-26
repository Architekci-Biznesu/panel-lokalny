import {
  categoryLabelTokens,
  isCategoryRefinement,
  normalizeCategoryLabel,
} from "@/features/wizytowka/reconcile-additional-categories";
import {
  weeklyMinutesFromGbpPeriods,
  weeklyMinutesFromOperatingHours,
} from "@/features/wizytowka/hours-compare";
import { cityFromStorefrontAddress } from "@/features/wizytowka/rank/city-from-address";
import type { GbpLocation } from "@/features/wizytowka/types";
import {
  localSearch,
  mapsPhotosCount,
  type ScrapingDogPlaceResult,
} from "@/lib/integrations/scrapingdog";

export type CompetitorCategoryStat = {
  gcid: string;
  displayName: string;
  count: number;
};

export type CompetitorPhotoSample = {
  title: string;
  photoCount: number;
  hasMore: boolean;
};

export type CompetitorPhotoStats = {
  ourCount: number;
  competitorMedian: number | null;
  competitorMax: number | null;
  samples: CompetitorPhotoSample[];
};

export type CompetitorHoursSample = {
  title: string;
  weeklyMinutes: number;
};

export type CompetitorHoursStats = {
  ourWeeklyMinutes: number;
  competitorMedian: number | null;
  competitorMax: number | null;
  samples: CompetitorHoursSample[];
};

export type CompetitorInsights = {
  phrases: string[];
  categoryStats: CompetitorCategoryStat[];
  titleSamples: string[];
  descriptionSamples: string[];
  photoStats: CompetitorPhotoStats | null;
  hoursStats: CompetitorHoursStats | null;
  suggestedRankPhrases: string[];
};

export type GbpAuditInsights = CompetitorInsights;

const EMPTY_INSIGHTS: CompetitorInsights = {
  phrases: [],
  categoryStats: [],
  titleSamples: [],
  descriptionSamples: [],
  photoStats: null,
  hoursStats: null,
  suggestedRankPhrases: [],
};

const BRAND_STOP = new Set([
  "sp",
  "zoo",
  "z",
  "o",
  "spolka",
  "firma",
  "phu",
  "ppuh",
  "s",
  "a",
  "ltd",
  "llc",
]);

function readLatLng(location: GbpLocation): { lat: number; lng: number } | null {
  const raw = location.latlng;
  if (!raw || typeof raw !== "object") return null;
  const latitude =
    typeof raw.latitude === "number"
      ? raw.latitude
      : typeof (raw as { lat?: number }).lat === "number"
        ? (raw as { lat: number }).lat
        : null;
  const longitude =
    typeof raw.longitude === "number"
      ? raw.longitude
      : typeof (raw as { lng?: number }).lng === "number"
        ? (raw as { lng: number }).lng
        : null;
  if (latitude == null || longitude == null) return null;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { lat: latitude, lng: longitude };
}

function splitServices(services: string): string[] {
  return services
    .split(/[,;\n|/]+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 3 && s.length <= 60);
}

function titleServiceSegments(title: string): string[] {
  const parts = title
    .split(/\s*[|\-–—]\s*/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length < 2) return [];
  // Skip first segment (usually brand); take middle service-like chunks.
  return parts.slice(1).filter((p) => {
    const tokens = normalizeCategoryLabel(p)
      .split(" ")
      .filter((t) => t.length >= 2 && !BRAND_STOP.has(t));
    return tokens.length >= 1 && tokens.length <= 5;
  });
}

/** Build 2-3 Local Pack seed phrases from primary category + brief/title. */
export function buildCompetitorSeedPhrases(input: {
  primaryDisplayName: string | null | undefined;
  city: string | null | undefined;
  title: string | null | undefined;
  briefServices: string | null | undefined;
}): string[] {
  const city = input.city?.trim() ?? "";
  const primary = input.primaryDisplayName?.trim() ?? "";
  const phrases: string[] = [];

  const push = (base: string) => {
    const cleaned = base.replace(/\s+/g, " ").trim();
    if (cleaned.length < 3) return;
    const withCity =
      city && !normalizeCategoryLabel(cleaned).includes(normalizeCategoryLabel(city))
        ? `${cleaned} ${city}`
        : cleaned;
    const key = normalizeCategoryLabel(withCity);
    if (!key) return;
    if (phrases.some((p) => normalizeCategoryLabel(p) === key)) return;
    phrases.push(withCity);
  };

  if (primary) push(primary);

  for (const svc of splitServices(input.briefServices ?? "")) {
    if (phrases.length >= 3) break;
    push(svc);
  }

  for (const seg of titleServiceSegments(input.title ?? "")) {
    if (phrases.length >= 3) break;
    push(seg);
  }

  return phrases.slice(0, 3);
}

export function matchTypeToCategory(
  typeLabel: string,
  available: Array<{ name: string; displayName: string }>,
): { name: string; displayName: string } | null {
  const needle = normalizeCategoryLabel(typeLabel);
  if (!needle) return null;

  let best: { name: string; displayName: string; score: number } | null = null;

  for (const cat of available) {
    const label = cat.displayName || cat.name;
    const hay = normalizeCategoryLabel(label);
    const gcidSlug = normalizeCategoryLabel(
      cat.name.replace(/^categories\/gcid:/i, "").replace(/_/g, " "),
    );
    if (!hay && !gcidSlug) continue;
    if (hay === needle || gcidSlug === needle) {
      return { name: cat.name, displayName: label };
    }
    let score = 0;
    if (
      (hay && (hay.includes(needle) || needle.includes(hay))) ||
      (gcidSlug && (gcidSlug.includes(needle) || needle.includes(gcidSlug)))
    ) {
      score = 0.85;
    } else if (
      isCategoryRefinement(label, typeLabel) ||
      isCategoryRefinement(typeLabel, label) ||
      (gcidSlug &&
        (isCategoryRefinement(gcidSlug, typeLabel) ||
          isCategoryRefinement(typeLabel, gcidSlug)))
    ) {
      score = 0.7;
    } else {
      const ta = categoryLabelTokens(typeLabel);
      const tb = [
        ...categoryLabelTokens(label),
        ...categoryLabelTokens(gcidSlug),
      ];
      if (ta.length && tb.length) {
        const shared = ta.filter((t) => tb.includes(t));
        score = shared.length / Math.min(ta.length, tb.length);
      }
    }
    if (score < 0.5) continue;
    if (!best || score > best.score) {
      best = { name: cat.name, displayName: label, score };
    }
  }

  return best ? { name: best.name, displayName: best.displayName } : null;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return Math.round((sorted[mid - 1]! + sorted[mid]!) / 2);
  }
  return sorted[mid]!;
}

function placeKey(place: ScrapingDogPlaceResult): string {
  return (
    place.placeId ||
    place.dataId ||
    `${normalizeCategoryLabel(place.title)}|${place.address ?? ""}`
  );
}

export async function fetchCompetitorInsights(input: {
  location: GbpLocation;
  primaryDisplayName: string | null | undefined;
  briefServices: string | null | undefined;
  availableCategories: Array<{ name: string; displayName: string }>;
  ourPhotoCount: number;
  suggestRankPhrases: boolean;
}): Promise<CompetitorInsights> {
  const city = cityFromStorefrontAddress(input.location.storefrontAddress);
  const coords = readLatLng(input.location);
  const ourWeeklyMinutes = weeklyMinutesFromGbpPeriods(
    input.location.regularHours?.periods,
  );
  const ourPlaceId = input.location.metadata?.placeId?.trim() || null;
  const phrases = buildCompetitorSeedPhrases({
    primaryDisplayName: input.primaryDisplayName,
    city,
    title: input.location.title,
    briefServices: input.briefServices,
  });

  if (!phrases.length || !city || !coords) {
    return {
      ...EMPTY_INSIGHTS,
      phrases,
      hoursStats: {
        ourWeeklyMinutes,
        competitorMedian: null,
        competitorMax: null,
        samples: [],
      },
      suggestedRankPhrases: input.suggestRankPhrases ? phrases : [],
    };
  }

  try {
    const packs = await Promise.all(
      phrases.map((query) =>
        localSearch({
          query,
          city,
          lat: coords.lat,
          lng: coords.lng,
        }).catch(() => [] as ScrapingDogPlaceResult[]),
      ),
    );

    const byKey = new Map<string, ScrapingDogPlaceResult>();
    for (const pack of packs) {
      for (const place of pack.slice(0, 10)) {
        if (
          ourPlaceId &&
          place.placeId &&
          place.placeId === ourPlaceId
        ) {
          continue;
        }
        const key = placeKey(place);
        if (!byKey.has(key)) byKey.set(key, place);
        if (byKey.size >= 20) break;
      }
      if (byKey.size >= 20) break;
    }

    const places = [...byKey.values()];
    const categoryCounts = new Map<
      string,
      { gcid: string; displayName: string; count: number }
    >();

    for (const place of places) {
      const typeLabels = place.types.length
        ? place.types
        : place.type
          ? [place.type]
          : [];
      for (const typeLabel of typeLabels) {
        const matched = matchTypeToCategory(typeLabel, input.availableCategories);
        if (!matched) continue;
        const prev = categoryCounts.get(matched.name);
        if (prev) {
          prev.count += 1;
        } else {
          categoryCounts.set(matched.name, {
            gcid: matched.name,
            displayName: matched.displayName,
            count: 1,
          });
        }
      }
    }

    const categoryStats = [...categoryCounts.values()].sort(
      (a, b) => b.count - a.count,
    );

    const titleSamples: string[] = [];
    const descriptionSamples: string[] = [];
    for (const place of places) {
      if (titleSamples.length < 8 && place.title.trim()) {
        titleSamples.push(place.title.trim());
      }
      const desc = place.description?.trim();
      if (desc && descriptionSamples.length < 8) {
        descriptionSamples.push(desc);
      }
    }

    const withDataId = places
      .filter((p) => Boolean(p.dataId))
      .slice(0, 5);

    const photoSamples: CompetitorPhotoSample[] = [];
    for (const place of withDataId) {
      try {
        const photos = await mapsPhotosCount(place.dataId!);
        photoSamples.push({
          title: place.title,
          photoCount: photos.count,
          hasMore: photos.hasMore,
        });
      } catch {
        // skip competitor photo failures
      }
    }

    const counts = photoSamples.map((s) => s.photoCount);
    const photoStats: CompetitorPhotoStats | null =
      photoSamples.length > 0
        ? {
            ourCount: input.ourPhotoCount,
            competitorMedian: median(counts),
            competitorMax: counts.length ? Math.max(...counts) : null,
            samples: photoSamples,
          }
        : {
            ourCount: input.ourPhotoCount,
            competitorMedian: null,
            competitorMax: null,
            samples: [],
          };

    const hoursSamples: CompetitorHoursSample[] = [];
    for (const place of places) {
      const weekly = weeklyMinutesFromOperatingHours(place.operatingHours);
      if (weekly == null) continue;
      hoursSamples.push({ title: place.title, weeklyMinutes: weekly });
      if (hoursSamples.length >= 10) break;
    }
    const hoursCounts = hoursSamples.map((s) => s.weeklyMinutes);
    const hoursStats: CompetitorHoursStats = {
      ourWeeklyMinutes,
      competitorMedian: median(hoursCounts),
      competitorMax: hoursCounts.length ? Math.max(...hoursCounts) : null,
      samples: hoursSamples,
    };

    return {
      phrases,
      categoryStats,
      titleSamples,
      descriptionSamples,
      photoStats,
      hoursStats,
      suggestedRankPhrases: input.suggestRankPhrases ? phrases : [],
    };
  } catch {
    return {
      ...EMPTY_INSIGHTS,
      phrases,
      hoursStats: {
        ourWeeklyMinutes,
        competitorMedian: null,
        competitorMax: null,
        samples: [],
      },
      suggestedRankPhrases: input.suggestRankPhrases ? phrases : [],
    };
  }
}

export function parseAuditInsights(raw: unknown): GbpAuditInsights | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  const phrases = Array.isArray(obj.phrases)
    ? obj.phrases.filter((p): p is string => typeof p === "string")
    : [];
  const suggestedRankPhrases = Array.isArray(obj.suggestedRankPhrases)
    ? obj.suggestedRankPhrases.filter((p): p is string => typeof p === "string")
    : [];
  const categoryStats = Array.isArray(obj.categoryStats)
    ? obj.categoryStats
        .map((row) => {
          if (!row || typeof row !== "object") return null;
          const r = row as Record<string, unknown>;
          if (
            typeof r.gcid !== "string" ||
            typeof r.displayName !== "string" ||
            typeof r.count !== "number"
          ) {
            return null;
          }
          return {
            gcid: r.gcid,
            displayName: r.displayName,
            count: r.count,
          };
        })
        .filter((r): r is CompetitorCategoryStat => Boolean(r))
    : [];
  const titleSamples = Array.isArray(obj.titleSamples)
    ? obj.titleSamples.filter((p): p is string => typeof p === "string")
    : [];
  const descriptionSamples = Array.isArray(obj.descriptionSamples)
    ? obj.descriptionSamples.filter((p): p is string => typeof p === "string")
    : [];

  let photoStats: CompetitorPhotoStats | null = null;
  if (obj.photoStats && typeof obj.photoStats === "object") {
    const p = obj.photoStats as Record<string, unknown>;
    const samples = Array.isArray(p.samples)
      ? p.samples
          .map((s) => {
            if (!s || typeof s !== "object") return null;
            const row = s as Record<string, unknown>;
            if (typeof row.title !== "string" || typeof row.photoCount !== "number") {
              return null;
            }
            return {
              title: row.title,
              photoCount: row.photoCount,
              hasMore: Boolean(row.hasMore),
            };
          })
          .filter((s): s is CompetitorPhotoSample => Boolean(s))
      : [];
    photoStats = {
      ourCount: typeof p.ourCount === "number" ? p.ourCount : 0,
      competitorMedian:
        typeof p.competitorMedian === "number" ? p.competitorMedian : null,
      competitorMax:
        typeof p.competitorMax === "number" ? p.competitorMax : null,
      samples,
    };
  }

  let hoursStats: CompetitorHoursStats | null = null;
  if (obj.hoursStats && typeof obj.hoursStats === "object") {
    const h = obj.hoursStats as Record<string, unknown>;
    const samples = Array.isArray(h.samples)
      ? h.samples
          .map((s) => {
            if (!s || typeof s !== "object") return null;
            const row = s as Record<string, unknown>;
            if (
              typeof row.title !== "string" ||
              typeof row.weeklyMinutes !== "number"
            ) {
              return null;
            }
            return {
              title: row.title,
              weeklyMinutes: row.weeklyMinutes,
            };
          })
          .filter((s): s is CompetitorHoursSample => Boolean(s))
      : [];
    hoursStats = {
      ourWeeklyMinutes:
        typeof h.ourWeeklyMinutes === "number" ? h.ourWeeklyMinutes : 0,
      competitorMedian:
        typeof h.competitorMedian === "number" ? h.competitorMedian : null,
      competitorMax:
        typeof h.competitorMax === "number" ? h.competitorMax : null,
      samples,
    };
  }

  return {
    phrases,
    categoryStats,
    titleSamples,
    descriptionSamples,
    photoStats,
    hoursStats,
    suggestedRankPhrases,
  };
}

/** Latest finished audit insights for a profile (null if none). */
export async function loadLatestAuditInsights(
  profileId: string,
): Promise<{ runId: string; insights: GbpAuditInsights } | null> {
  const { and, desc, eq } = await import("drizzle-orm");
  const { db } = await import("@/lib/db");
  const { gbpAuditRuns } = await import("@/lib/db/schema");

  const [run] = await db
    .select({
      id: gbpAuditRuns.id,
      insights: gbpAuditRuns.insights,
    })
    .from(gbpAuditRuns)
    .where(
      and(eq(gbpAuditRuns.profileId, profileId), eq(gbpAuditRuns.status, "done")),
    )
    .orderBy(desc(gbpAuditRuns.finishedAt))
    .limit(1);

  if (!run) return null;
  const insights = parseAuditInsights(run.insights);
  if (!insights) return null;
  return { runId: run.id, insights };
}

export async function updateAuditSuggestedRankPhrases(
  profileId: string,
  nextPhrases: string[],
): Promise<boolean> {
  const loaded = await loadLatestAuditInsights(profileId);
  if (!loaded) return false;

  const { and, eq } = await import("drizzle-orm");
  const { db } = await import("@/lib/db");
  const { gbpAuditRuns } = await import("@/lib/db/schema");

  const next: GbpAuditInsights = {
    ...loaded.insights,
    suggestedRankPhrases: nextPhrases,
  };

  await db
    .update(gbpAuditRuns)
    .set({ insights: next as unknown as Record<string, unknown> })
    .where(
      and(
        eq(gbpAuditRuns.id, loaded.runId),
        eq(gbpAuditRuns.profileId, profileId),
      ),
    );

  return true;
}
