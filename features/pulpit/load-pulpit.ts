import {
  computeCompleteness,
  type CompletenessCheck,
} from "@/features/wizytowka/completeness";
import { loadActiveGbpBundle } from "@/features/wizytowka/load-location";
import {
  isProposalField,
  PROPOSAL_META,
  uniquePendingByField,
} from "@/features/wizytowka/proposal-meta";
import {
  getActiveGbpProfile,
  getGbpAccessTokenForProfile,
  GbpNotConnectedError,
} from "@/lib/integrations/gbp/access";
import {
  countGbpOwnerPhotos,
  fetchGbpMultiDailyMetrics,
  listGbpLocationMedia,
} from "@/lib/integrations/gbp/client";
import { AuthError } from "@/lib/session";
import type { GbpSuggestion } from "@/lib/db/schema";
import {
  ALL_PERFORMANCE_METRICS,
  buildReportSummary,
  defaultRange,
  emptySeriesForMetrics,
  fromDateParts,
  IMPRESSION_METRICS,
  METRIC_LABELS,
  parsePerformancePayload,
  toDateParts,
  type MetricSeries,
  type ReportSummary,
} from "@/features/wizytowka/performance";
import {
  loadPulpitRankPhrases,
  type PulpitRankPhrase,
} from "@/features/pulpit/load-pulpit-rank";

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

export type PulpitPayload = {
  connected: boolean;
  reportSummary: ReportSummary | null;
  reportRangeLabel: string | null;
  monthVisibility: PulpitMonthVisibility | null;
  rankPhrases: PulpitRankPhrase[];
  improve: {
    checks: CompletenessCheck[];
  } | null;
  proposals: PulpitProposalItem[];
  proposalsTotal: number;
  loadError: string | null;
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

function emptyPayload(
  partial: Partial<PulpitPayload> & {
    connected: boolean;
    loadError: string | null;
  },
): PulpitPayload {
  return {
    reportSummary: null,
    reportRangeLabel: null,
    monthVisibility: null,
    rankPhrases: [],
    improve: null,
    proposals: [],
    proposalsTotal: 0,
    ...partial,
  };
}

export async function loadPulpitPayload(): Promise<PulpitPayload> {
  try {
    const range = defaultRange();
    const rangeStart = fromDateParts(range.start);
    const rangeEnd = fromDateParts(range.end);

    const profile = await getActiveGbpProfile();
    const token = await getGbpAccessTokenForProfile(profile);

    let series = emptySeriesForMetrics(ALL_PERFORMANCE_METRICS);
    let prevYearSeries: MetricSeries[] | null = null;
    let metricsError: string | null = null;
    try {
      const payload = await fetchGbpMultiDailyMetrics(
        token,
        profile.gbpLocationId!,
        ALL_PERFORMANCE_METRICS,
        range.start,
        range.end,
      );
      const parsed = parsePerformancePayload(payload);
      if (parsed.length > 0) {
        const byMetric = new Map(parsed.map((s) => [s.metric, s]));
        series = ALL_PERFORMANCE_METRICS.map(
          (metric) =>
            byMetric.get(metric) ?? {
              metric,
              label: METRIC_LABELS[metric],
              total: 0,
              points: [],
            },
        );
      }

      const prevStart = new Date(
        rangeEnd.getFullYear() - 1,
        rangeEnd.getMonth(),
        1,
      );
      const prevEnd = new Date(
        rangeEnd.getFullYear() - 1,
        rangeEnd.getMonth(),
        rangeEnd.getDate(),
      );
      try {
        const prevPayload = await fetchGbpMultiDailyMetrics(
          token,
          profile.gbpLocationId!,
          IMPRESSION_METRICS,
          toDateParts(prevStart),
          toDateParts(prevEnd),
        );
        const prevParsed = parsePerformancePayload(prevPayload);
        if (prevParsed.length > 0) {
          prevYearSeries = prevParsed;
        }
      } catch {
        prevYearSeries = null;
      }
    } catch {
      metricsError = "Nie udało się pobrać widoczności z Google.";
    }

    const bundle = await loadActiveGbpBundle();
    let photoCount = 0;
    try {
      const media = await listGbpLocationMedia(
        bundle.accessToken,
        bundle.locationName,
      );
      photoCount = countGbpOwnerPhotos(media.owner);
    } catch {
      photoCount = 0;
    }

    const summary = computeCompleteness({
      location: bundle.location,
      attributes: bundle.attributes,
      attributeMetadata: bundle.attributeMetadata,
      pendingSuggestions: bundle.pendingSuggestions,
      photoCount,
      lastAnalyzedAt:
        bundle.latestAuditRun?.status === "done"
          ? bundle.latestAuditRun.finishedAt
          : (bundle.latestAuditRun?.startedAt ?? null),
    });

    const pending = uniquePendingByField(bundle.pendingSuggestions);
    const proposalItems: PulpitProposalItem[] = pending
      .filter((s) => isProposalField(s.field))
      .map((s) => ({
        id: s.id,
        field: s.field,
        label: PROPOSAL_META[s.field].label,
        hint: proposalHint(s),
        href: PROPOSAL_META[s.field].href,
      }));

    let rankPhrases: PulpitRankPhrase[] = [];
    try {
      rankPhrases = await loadPulpitRankPhrases();
    } catch {
      rankPhrases = [];
    }

    return {
      connected: true,
      reportSummary: buildReportSummary(series),
      reportRangeLabel: formatRangeLabel(rangeStart, rangeEnd),
      monthVisibility: buildMonthVisibility(
        series,
        rangeStart,
        rangeEnd,
        prevYearSeries,
      ),
      rankPhrases,
      improve: {
        checks: summary.checks.filter((c) => !c.filled),
      },
      proposals: proposalItems.slice(0, PROPOSALS_PREVIEW),
      proposalsTotal: proposalItems.length,
      loadError: metricsError,
    };
  } catch (error) {
    if (error instanceof GbpNotConnectedError || error instanceof AuthError) {
      return emptyPayload({ connected: false, loadError: null });
    }
    return emptyPayload({
      connected: false,
      loadError:
        error instanceof Error
          ? error.message
          : "Nie udało się wczytać pulpitu",
    });
  }
}
