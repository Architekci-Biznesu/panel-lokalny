import { RaportyView } from "@/features/wizytowka/components/raporty-view";
import { loadLatestAuditInsights } from "@/features/wizytowka/competitor-insights";
import {
  ALL_PERFORMANCE_METRICS,
  emptySeriesForMetrics,
  METRIC_LABELS,
  parsePerformancePayload,
  resolveRangeFromSearchParams,
} from "@/features/wizytowka/performance";
import { loadRankRaportPayload } from "@/features/wizytowka/rank/load-raport";
import {
  getActiveGbpProfile,
  getGbpAccessTokenForProfile,
  GbpNotConnectedError,
} from "@/lib/integrations/gbp/access";
import { fetchGbpMultiDailyMetrics } from "@/lib/integrations/gbp/client";
import { cachedGbpRead } from "@/lib/integrations/gbp/read-cache";

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
      keywords: Awaited<
        ReturnType<typeof loadRankRaportPayload>
      >["keywords"];
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
    const { start, end } = resolveRangeFromSearchParams(params);
    const profile = await getActiveGbpProfile();
    const token = await getGbpAccessTokenForProfile(profile);

    let series = emptySeriesForMetrics(ALL_PERFORMANCE_METRICS);
    let loadError = false;

    try {
      const range = `${start.year}-${start.month}-${start.day}_${end.year}-${end.month}-${end.day}`;
      const payload = await cachedGbpRead(
        profile.id,
        `metrics:${profile.gbpLocationId}:${range}`,
        () =>
          fetchGbpMultiDailyMetrics(
            token,
            profile.gbpLocationId!,
            ALL_PERFORMANCE_METRICS,
            start,
            end,
          ),
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
