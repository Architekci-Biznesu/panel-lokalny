import { RaportyView } from "@/features/wizytowka/components/raporty-view";
import {
  ALL_PERFORMANCE_METRICS,
  emptySeriesForMetrics,
  METRIC_LABELS,
  parsePerformancePayload,
  resolveRangeFromSearchParams,
} from "@/features/wizytowka/performance";
import {
  getActiveGbpProfile,
  getGbpAccessTokenForProfile,
  GbpNotConnectedError,
} from "@/lib/integrations/gbp/access";
import { fetchGbpMultiDailyMetrics } from "@/lib/integrations/gbp/client";

export default async function RaportyPage({
  searchParams,
}: {
  searchParams: Promise<{ start?: string; end?: string }>;
}) {
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

    return (
      <RaportyView
        series={series}
        start={start}
        end={end}
        loadError={loadError}
      />
    );
  } catch (error) {
    if (error instanceof GbpNotConnectedError) return null;
    throw error;
  }
}
