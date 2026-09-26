import { RaportyView } from "@/features/wizytowka/components/raporty-view";
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
    rank: Awaited<ReturnType<typeof loadRankRaportPayload>> | {
      placeId: string | null;
      businessName: string;
      keywords: [];
      latestByKeyword: Record<string, never>;
      scansByKeywordDay: Record<string, never>;
      activeScan: null;
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
      const payload = await fetchGbpMultiDailyMetrics(
        token,
        profile.gbpLocationId!,
        ALL_PERFORMANCE_METRICS,
        start,
        end,
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

    let rank = null;
    try {
      rank = await loadRankRaportPayload(params.keyword ?? null);
    } catch {
      rank = {
        placeId: profile.gbpPlaceId,
        businessName: profile.name,
        keywords: [],
        latestByKeyword: {},
        scansByKeywordDay: {},
        activeScan: null,
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
