import { RaportyView } from "@/features/wizytowka/components/raporty-view";
import { loadLatestAuditInsights } from "@/features/wizytowka/competitor-insights";
import {
  ALL_PERFORMANCE_METRICS,
  defaultRange,
  emptySeriesForMetrics,
  formatDateIso,
  METRIC_LABELS,
  parsePerformancePayload,
  resolveRangeFromSearchParams,
} from "@/features/wizytowka/performance";
import { loadRankRaportPayload } from "@/features/wizytowka/rank/load-raport";
import { readGbpSnapshot } from "@/features/wizytowka/snapshots/read";
import { metricsKey } from "@/features/wizytowka/snapshots/sources";
import {
  getActiveGbpProfile,
  GbpNotConnectedError,
} from "@/lib/integrations/gbp/access";

export default async function RaportyPage({
  searchParams,
}: {
  searchParams: Promise<{ start?: string; end?: string; keyword?: string }>;
}) {
  let viewProps: {
    series: ReturnType<typeof emptySeriesForMetrics>;
    start: ReturnType<typeof resolveRangeFromSearchParams>["start"];
    end: ReturnType<typeof resolveRangeFromSearchParams>["end"];
    loadError: boolean;
    rank: {
      placeId: string | null;
      businessName: string;
      keywords: Awaited<ReturnType<typeof loadRankRaportPayload>>["keywords"];
      latestByKeyword: Awaited<
        ReturnType<typeof loadRankRaportPayload>
      >["latestByKeyword"];
      scansByKeywordDay: Awaited<
        ReturnType<typeof loadRankRaportPayload>
      >["scansByKeywordDay"];
      activeScan: Awaited<
        ReturnType<typeof loadRankRaportPayload>
      >["activeScan"];
      suggestedPhrases: string[];
    };
  } | null = null;

  try {
    const params = await searchParams;
    const requested = resolveRangeFromSearchParams(params);
    let { start, end } = requested;
    const profile = await getActiveGbpProfile();

    let series = emptySeriesForMetrics(ALL_PERFORMANCE_METRICS);
    let loadError = false;

    try {
      // The default range rolls every day - it shares the named "last30"
      // snapshot with Pulpit. Only a range picked by hand gets dates in the key.
      const rolling = defaultRange();
      const isDefault =
        formatDateIso(requested.start) === formatDateIso(rolling.start) &&
        formatDateIso(requested.end) === formatDateIso(rolling.end);
      const snapshot = await readGbpSnapshot(
        profile,
        "metrics",
        metricsKey(profile.gbpLocationId!, isDefault ? "last30" : requested),
      );
      ({ start, end } = snapshot.data);
      const parsed = parsePerformancePayload(snapshot.data.payload);
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
      loadError = true;
    }

    let rank: {
      placeId: string | null;
      businessName: string;
      keywords: Awaited<ReturnType<typeof loadRankRaportPayload>>["keywords"];
      latestByKeyword: Awaited<
        ReturnType<typeof loadRankRaportPayload>
      >["latestByKeyword"];
      scansByKeywordDay: Awaited<
        ReturnType<typeof loadRankRaportPayload>
      >["scansByKeywordDay"];
      activeScan: Awaited<
        ReturnType<typeof loadRankRaportPayload>
      >["activeScan"];
      suggestedPhrases: string[];
    };
    try {
      const loaded = await loadRankRaportPayload(params.keyword ?? null);
      let suggestedPhrases: string[] = [];
      if (loaded.keywords.length === 0) {
        const insights = await loadLatestAuditInsights(profile.id);
        suggestedPhrases = insights?.insights.suggestedRankPhrases ?? [];
      }
      rank = { ...loaded, suggestedPhrases };
    } catch {
      const insights = await loadLatestAuditInsights(profile.id).catch(
        () => null,
      );
      rank = {
        placeId: profile.gbpPlaceId,
        businessName: profile.name,
        keywords: [],
        latestByKeyword: {},
        scansByKeywordDay: {},
        activeScan: null,
        suggestedPhrases: insights?.insights.suggestedRankPhrases ?? [],
      };
    }

    viewProps = { series, start, end, loadError, rank };
  } catch (error) {
    if (error instanceof GbpNotConnectedError) return null;
    throw error;
  }

  return (
    <RaportyView
      series={viewProps.series}
      start={viewProps.start}
      end={viewProps.end}
      loadError={viewProps.loadError}
      rank={viewProps.rank}
    />
  );
}
