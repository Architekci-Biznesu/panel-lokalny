import { cache } from "react";
import {
  loadPulpitReviews,
  type PulpitReviews,
} from "@/features/opinie/load-pulpit-reviews";
import {
  computeCompleteness,
  type CompletenessCheck,
} from "@/features/wizytowka/completeness";
import {
  loadActiveGbpBundle,
  loadGbpMedia,
} from "@/features/wizytowka/load-location";
import {
  isProposalField,
  PROPOSAL_META,
  uniquePendingByField,
} from "@/features/wizytowka/proposal-meta";
import {
  getActiveGbpProfile,
  GbpNotConnectedError,
} from "@/lib/integrations/gbp/access";
import { countGbpOwnerPhotos } from "@/lib/integrations/gbp/client";
import { AuthError } from "@/lib/session";
import type { ContentChannel, GbpSuggestion, Profile } from "@/lib/db/schema";
import {
  loadPublishingRhythm,
  loadRecentPublished,
  type PublishingRhythm,
} from "@/features/publikacje/load-published";
import {
  ALL_PERFORMANCE_METRICS,
  buildReportSummary,
  emptySeriesForMetrics,
  fromDateParts,
  IMPRESSION_METRICS,
  METRIC_LABELS,
  parsePerformancePayload,
  type MetricSeries,
  type ReportSummary,
} from "@/features/wizytowka/performance";
import {
  loadPulpitRankPhrases,
  type PulpitRankPhrase,
} from "@/features/pulpit/load-pulpit-rank";
import { readGbpSnapshot } from "@/features/wizytowka/snapshots/read";
import { metricsKey } from "@/features/wizytowka/snapshots/sources";

export type PulpitMonthDay = {
  date: string;
  value: number;
};

export type PulpitMonthVisibility = {
  days: PulpitMonthDay[];
  total: number;
  /** Ten sam miesiąc rok wcześniej (MTD). null = brak danych / nie pokazuj. */
  changePct: number | null;
  /** np. "vs wrzesień 2025" */
  compareLabel: string | null;
};

export type PulpitProposalItem = {
  id: string;
  field: string;
  label: string;
  hint: string;
  href: string;
};

export type PulpitPublication = {
  targetId: string;
  title: string;
  channel: ContentChannel;
  date: Date | null;
  imageUrl: string | null;
};

/** Parts of Pulpit from our own database - shown at once. */
export type PulpitBase = {
  connected: boolean;
  /** Active profile with a connected listing (null when not connected). */
  profile: Profile | null;
  rankPhrases: PulpitRankPhrase[];
  publications: PulpitPublication[];
  /** Weeks with a post and the next scheduled one (null when it could not be read) */
  rhythm: PublishingRhythm | null;
  /** Reviews from the Opinie module (null when it could not be read) */
  reviews: PulpitReviews | null;
  loadError: string | null;
};

/** Statistics tiles - from the metrics snapshots. */
export type PulpitMetrics = {
  reportSummary: ReportSummary | null;
  reportRangeLabel: string | null;
  monthVisibility: PulpitMonthVisibility | null;
  loadError: string | null;
};

/** "Popraw wizytówkę" - from the listing and photo snapshots. */
export type PulpitImprove = {
  improve: { checks: CompletenessCheck[] } | null;
  proposals: PulpitProposalItem[];
  proposalsTotal: number;
};

const PROPOSALS_PREVIEW = 8;

function proposalHint(suggestion: GbpSuggestion): string {
  if (suggestion.risk === "high" || suggestion.field === "title") {
    return "AI proponuje zmianę · pod SEO";
  }
  if (suggestion.field === "primary_category") {
    return "AI proponuje zmianę · kategoria główna";
  }
  if (suggestion.field === "additional_categories") {
    return "AI proponuje zmianę · kategorie";
  }
  if (suggestion.field === "services") {
    return "AI proponuje zmianę · usługi";
  }
  if (suggestion.field === "description") {
    return "AI proponuje zmianę · opis";
  }
  return "AI proponuje zmianę";
}

function addDaysDate(d: Date, n: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
}

function isoDay(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatRangeLabel(start: Date, end: Date): string {
  const fmt = new Intl.DateTimeFormat("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  return `${fmt.format(start)} - ${fmt.format(end)}`;
}

/** Sum impression metrics per calendar day. */
export function dailyImpressionTotals(
  series: MetricSeries[],
): Map<string, number> {
  const map = new Map<string, number>();
  for (const metric of IMPRESSION_METRICS) {
    const item = series.find((s) => s.metric === metric);
    if (!item) continue;
    for (const point of item.points) {
      map.set(point.date, (map.get(point.date) ?? 0) + point.value);
    }
  }
  return map;
}

function sumImpressionsInRange(
  byDay: Map<string, number>,
  start: Date,
  end: Date,
): number {
  let total = 0;
  for (let d = new Date(start); d <= end; d = addDaysDate(d, 1)) {
    total += byDay.get(isoDay(d)) ?? 0;
  }
  return total;
}

function hasImpressionsInRange(
  byDay: Map<string, number>,
  start: Date,
  end: Date,
): boolean {
  for (let d = new Date(start); d <= end; d = addDaysDate(d, 1)) {
    if ((byDay.get(isoDay(d)) ?? 0) > 0) return true;
  }
  return false;
}

function monthCompareLabel(monthDate: Date): string {
  const label = new Intl.DateTimeFormat("pl-PL", {
    month: "long",
    year: "numeric",
  }).format(monthDate);
  return `vs ${label}`;
}

/**
 * Wykres: okno `rangeStart`–`rangeEnd` (30 dni).
 * Porównanie: ten sam miesiąc kalendarzowy rok wcześniej (MTD do `rangeEnd`).
 * Bez danych w poprzednim roku → changePct = null.
 */
export function buildMonthVisibility(
  series: MetricSeries[],
  rangeStart: Date,
  rangeEnd: Date,
  prevYearSeries: MetricSeries[] | null = null,
): PulpitMonthVisibility {
  const byDay = dailyImpressionTotals(series);
  const days: PulpitMonthDay[] = [];
  const start = new Date(rangeStart);
  start.setHours(0, 0, 0, 0);
  const end = new Date(rangeEnd);
  end.setHours(0, 0, 0, 0);

  for (let d = new Date(start); d <= end; d = addDaysDate(d, 1)) {
    const date = isoDay(d);
    days.push({ date, value: byDay.get(date) ?? 0 });
  }

  const total = days.reduce((sum, day) => sum + day.value, 0);

  const monthStart = new Date(end.getFullYear(), end.getMonth(), 1);
  monthStart.setHours(0, 0, 0, 0);
  const currentMonthTotal = sumImpressionsInRange(byDay, monthStart, end);

  let changePct: number | null = null;
  let compareLabel: string | null = null;

  if (prevYearSeries) {
    const prevByDay = dailyImpressionTotals(prevYearSeries);
    const prevStart = new Date(end.getFullYear() - 1, end.getMonth(), 1);
    prevStart.setHours(0, 0, 0, 0);
    const prevEnd = new Date(
      end.getFullYear() - 1,
      end.getMonth(),
      end.getDate(),
    );
    prevEnd.setHours(0, 0, 0, 0);

    if (hasImpressionsInRange(prevByDay, prevStart, prevEnd)) {
      const prevTotal = sumImpressionsInRange(prevByDay, prevStart, prevEnd);
      if (prevTotal > 0) {
        changePct = ((currentMonthTotal - prevTotal) / prevTotal) * 100;
        compareLabel = monthCompareLabel(prevStart);
      }
    }
  }

  return { days, total, changePct, compareLabel };
}

async function loadPulpitReviewsSafe(
  profile: Profile,
): Promise<PulpitReviews | null> {
  try {
    return await loadPulpitReviews(profile);
  } catch (error) {
    console.error("Pulpit reviews failed:", error);
    return null;
  }
}

const PUBLICATIONS_PREVIEW = 3;

async function loadPublishingRhythmSafe(
  profile: Profile,
): Promise<PublishingRhythm | null> {
  try {
    return await loadPublishingRhythm(profile);
  } catch (error) {
    console.error("Pulpit publishing rhythm failed:", error);
    return null;
  }
}

async function loadPulpitPublications(
  profile: Profile,
): Promise<PulpitPublication[]> {
  try {
    const rows = await loadRecentPublished(profile, PUBLICATIONS_PREVIEW);
    return rows.map(({ targetId, title, channel, date, imageUrl }) => ({
      targetId,
      title,
      channel,
      date,
      imageUrl,
    }));
  } catch (error) {
    console.error("Pulpit publications failed:", error);
    return [];
  }
}

/**
 * Everything on Pulpit that comes from our database, loaded in parallel.
 * Google tiles load separately (loadPulpitMetrics / loadPulpitImprove) inside
 * their own Suspense boundaries.
 */
export async function loadPulpitBase(): Promise<PulpitBase> {
  let profile: Profile;
  try {
    profile = await getActiveGbpProfile();
  } catch (error) {
    if (error instanceof GbpNotConnectedError || error instanceof AuthError) {
      return {
        connected: false,
        profile: null,
        rankPhrases: [],
        publications: [],
        rhythm: null,
        reviews: null,
        loadError: null,
      };
    }
    throw error;
  }

  const [rankPhrases, publications, rhythm, reviews] = await Promise.all([
    loadPulpitRankPhrases(profile).catch((error) => {
      console.error("Pulpit rank phrases failed:", error);
      return [] as PulpitRankPhrase[];
    }),
    loadPulpitPublications(profile),
    loadPublishingRhythmSafe(profile),
    loadPulpitReviewsSafe(profile),
  ]);

  return {
    connected: true,
    profile,
    rankPhrases,
    publications,
    rhythm,
    reviews,
    loadError: null,
  };
}

function seriesFromPayload(payload: unknown): MetricSeries[] {
  const parsed = parsePerformancePayload(payload);
  if (parsed.length === 0)
    return emptySeriesForMetrics(ALL_PERFORMANCE_METRICS);
  const byMetric = new Map(parsed.map((s) => [s.metric, s]));
  return ALL_PERFORMANCE_METRICS.map(
    (metric) =>
      byMetric.get(metric) ?? {
        metric,
        label: METRIC_LABELS[metric],
        total: 0,
        points: [],
      },
  );
}

/**
 * Last 30 days and the same month a year ago, both from rolling-range
 * snapshots. The window comes from the dates saved in the snapshot, so a
 * snapshot from yesterday still matches its own chart.
 */
export const loadPulpitMetrics = cache(
  async (profile: Profile): Promise<PulpitMetrics> => {
    const locationName = profile.gbpLocationId!;
    const [current, prevYear] = await Promise.all([
      readGbpSnapshot(profile, "metrics", metricsKey(locationName, "last30")),
      readGbpSnapshot(
        profile,
        "metrics",
        metricsKey(locationName, "last30-prev-year"),
      ).catch(() => null),
    ]).catch((error) => {
      console.error("Pulpit metrics failed:", error);
      return [null, null] as const;
    });

    if (!current) {
      return {
        reportSummary: buildReportSummary(
          emptySeriesForMetrics(ALL_PERFORMANCE_METRICS),
        ),
        reportRangeLabel: null,
        monthVisibility: null,
        loadError: "Nie udało się pobrać widoczności z Google.",
      };
    }

    const rangeStart = fromDateParts(current.data.start);
    const rangeEnd = fromDateParts(current.data.end);
    const series = seriesFromPayload(current.data.payload);
    const prevParsed = prevYear
      ? parsePerformancePayload(prevYear.data.payload).filter((s) =>
          IMPRESSION_METRICS.includes(s.metric),
        )
      : [];

    return {
      reportSummary: buildReportSummary(series),
      reportRangeLabel: formatRangeLabel(rangeStart, rangeEnd),
      monthVisibility: buildMonthVisibility(
        series,
        rangeStart,
        rangeEnd,
        prevParsed.length > 0 ? prevParsed : null,
      ),
      loadError: null,
    };
  },
);

export const loadPulpitImprove = cache(
  async (profile: Profile): Promise<PulpitImprove> => {
    try {
      const [bundle, media] = await Promise.all([
        loadActiveGbpBundle(),
        loadGbpMedia(profile),
      ]);

      const summary = computeCompleteness({
        location: bundle.location,
        attributes: bundle.attributes,
        attributeMetadata: bundle.attributeMetadata,
        pendingSuggestions: bundle.pendingSuggestions,
        photoCount: countGbpOwnerPhotos(media.owner),
        lastAnalyzedAt:
          bundle.latestAuditRun?.status === "done"
            ? bundle.latestAuditRun.finishedAt
            : (bundle.latestAuditRun?.startedAt ?? null),
      });

      const proposalItems: PulpitProposalItem[] = uniquePendingByField(
        bundle.pendingSuggestions,
      )
        .filter((s) => isProposalField(s.field))
        .map((s) => ({
          id: s.id,
          field: s.field,
          label: PROPOSAL_META[s.field].label,
          hint: proposalHint(s),
          href: PROPOSAL_META[s.field].href,
        }));

      return {
        improve: { checks: summary.checks.filter((c) => !c.filled) },
        proposals: proposalItems.slice(0, PROPOSALS_PREVIEW),
        proposalsTotal: proposalItems.length,
      };
    } catch (error) {
      console.error("Pulpit improve failed:", error);
      return { improve: null, proposals: [], proposalsTotal: 0 };
    }
  },
);
