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
  type MetricSeries,
  type ReportSummary,
} from "@/features/wizytowka/performance";
import {
  loadPulpitRankSnapshot,
  type PulpitRankSnapshot,
} from "@/features/pulpit/load-pulpit-rank";

export type PulpitDayPoint = {
  date: string;
  label: string;
  value: number;
};

export type PulpitVisibility = {
  days: PulpitDayPoint[];
  thisWeekTotal: number;
  prevWeekTotal: number;
  changePct: number | null;
};

export type PulpitImproveGap = {
  id: string;
  label: string;
  why: string;
  href?: string;
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
  visibility: PulpitVisibility | null;
  rank: PulpitRankSnapshot | null;
  improve: {
    checks: CompletenessCheck[];
    gaps: PulpitImproveGap[];
  } | null;
  proposals: PulpitProposalItem[];
  proposalsTotal: number;
  loadError: string | null;
};

const DAY_LABELS = ["Pn", "Wt", "Śr", "Cz", "Pt", "Sb", "Nd"] as const;
const PROPOSALS_PREVIEW = 5;

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

function startOfWeekMonday(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  return copy;
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

export function buildWeekVisibility(
  series: MetricSeries[],
  now = new Date(),
): PulpitVisibility {
  const byDay = dailyImpressionTotals(series);
  const weekStart = startOfWeekMonday(now);
  const prevStart = addDaysDate(weekStart, -7);

  const days: PulpitDayPoint[] = DAY_LABELS.map((label, i) => {
    const date = isoDay(addDaysDate(weekStart, i));
    return {
      date,
      label,
      value: byDay.get(date) ?? 0,
    };
  });

  let thisWeekTotal = 0;
  let prevWeekTotal = 0;
  for (let i = 0; i < 7; i++) {
    thisWeekTotal += byDay.get(isoDay(addDaysDate(weekStart, i))) ?? 0;
    prevWeekTotal += byDay.get(isoDay(addDaysDate(prevStart, i))) ?? 0;
  }

  let changePct: number | null = null;
  if (prevWeekTotal > 0) {
    changePct = ((thisWeekTotal - prevWeekTotal) / prevWeekTotal) * 100;
  } else if (thisWeekTotal > 0) {
    changePct = 100;
  }

  return { days, thisWeekTotal, prevWeekTotal, changePct };
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
    visibility: null,
    rank: null,
    improve: null,
    proposals: [],
    proposalsTotal: 0,
    ...partial,
  };
}

export async function loadPulpitPayload(): Promise<PulpitPayload> {
  try {
    const now = new Date();
    const range = defaultRange();
    const rangeStart = fromDateParts(range.start);
    const rangeEnd = fromDateParts(range.end);

    const profile = await getActiveGbpProfile();
    const token = await getGbpAccessTokenForProfile(profile);

    let series = emptySeriesForMetrics(ALL_PERFORMANCE_METRICS);
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

    let rank: PulpitRankSnapshot | null = null;
    try {
      rank = await loadPulpitRankSnapshot();
    } catch {
      rank = null;
    }

    return {
      connected: true,
      reportSummary: buildReportSummary(series),
      reportRangeLabel: formatRangeLabel(rangeStart, rangeEnd),
      visibility: buildWeekVisibility(series, now),
      rank,
      improve: {
        checks: summary.checks.filter((c) => !c.filled),
        gaps: summary.outsidePanelGaps,
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
