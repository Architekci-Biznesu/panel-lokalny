import { computeCompleteness } from "@/features/wizytowka/completeness";
import { loadActiveGbpBundle } from "@/features/wizytowka/load-location";
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
import {
  ALL_PERFORMANCE_METRICS,
  emptySeriesForMetrics,
  IMPRESSION_METRICS,
  METRIC_LABELS,
  parsePerformancePayload,
  toDateParts,
  type MetricSeries,
} from "@/features/wizytowka/performance";

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

export type PulpitStatus = {
  filledCount: number;
  filledTotal: number;
  pendingSuggestions: number;
  /** // TODO Styl 4: podłączyć loader opinii, gdy będzie w projekcie */
  newReviewsCount: number | null;
  lastAnalyzedAt: string | null;
};

export type PulpitPayload = {
  connected: boolean;
  visibility: PulpitVisibility | null;
  status: PulpitStatus | null;
  loadError: string | null;
};

const DAY_LABELS = ["Pn", "Wt", "Śr", "Cz", "Pt", "Sb", "Nd"] as const;

function startOfWeekMonday(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  return copy;
}

function addDays(d: Date, n: number): Date {
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
  const prevStart = addDays(weekStart, -7);

  const days: PulpitDayPoint[] = DAY_LABELS.map((label, i) => {
    const date = isoDay(addDays(weekStart, i));
    return {
      date,
      label,
      value: byDay.get(date) ?? 0,
    };
  });

  let thisWeekTotal = 0;
  let prevWeekTotal = 0;
  for (let i = 0; i < 7; i++) {
    thisWeekTotal += byDay.get(isoDay(addDays(weekStart, i))) ?? 0;
    prevWeekTotal += byDay.get(isoDay(addDays(prevStart, i))) ?? 0;
  }

  let changePct: number | null = null;
  if (prevWeekTotal > 0) {
    changePct = ((thisWeekTotal - prevWeekTotal) / prevWeekTotal) * 100;
  } else if (thisWeekTotal > 0) {
    changePct = 100;
  }

  return { days, thisWeekTotal, prevWeekTotal, changePct };
}

export async function loadPulpitPayload(): Promise<PulpitPayload> {
  try {
    const now = new Date();
    const weekStart = startOfWeekMonday(now);
    const rangeStart = addDays(weekStart, -7);
    const rangeEnd = addDays(weekStart, 6);

    const profile = await getActiveGbpProfile();
    const token = await getGbpAccessTokenForProfile(profile);

    let series = emptySeriesForMetrics(ALL_PERFORMANCE_METRICS);
    let metricsError: string | null = null;
    try {
      const payload = await fetchGbpMultiDailyMetrics(
        token,
        profile.gbpLocationId!,
        ALL_PERFORMANCE_METRICS,
        toDateParts(rangeStart),
        toDateParts(rangeEnd),
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

    const analyzedAt = summary.lastAnalyzedAt;
    const lastAnalyzedAt =
      analyzedAt instanceof Date
        ? analyzedAt.toISOString()
        : analyzedAt
          ? new Date(analyzedAt).toISOString()
          : null;

    return {
      connected: true,
      visibility: buildWeekVisibility(series, now),
      status: {
        filledCount: summary.filledCount,
        filledTotal: summary.filledTotal,
        pendingSuggestions: summary.pendingSuggestions,
        // TODO Styl 4: podłączyć loader opinii, gdy będzie w projekcie
        newReviewsCount: null,
        lastAnalyzedAt,
      },
      loadError: metricsError,
    };
  } catch (error) {
    if (error instanceof GbpNotConnectedError || error instanceof AuthError) {
      return {
        connected: false,
        visibility: null,
        status: null,
        loadError: null,
      };
    }
    return {
      connected: false,
      visibility: null,
      status: null,
      loadError:
        error instanceof Error
          ? error.message
          : "Nie udało się wczytać pulpitu",
    };
  }
}
