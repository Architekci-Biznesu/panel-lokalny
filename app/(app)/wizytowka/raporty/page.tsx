import {
  parsePerformancePayload,
  RaportyView,
} from "@/features/wizytowka/components/raporty-view";
import {
  getActiveGbpProfile,
  getGbpAccessTokenForProfile,
  GbpNotConnectedError,
} from "@/lib/integrations/gbp/access";
import {
  fetchGbpMultiDailyMetrics,
  type DailyMetric,
} from "@/lib/integrations/gbp/client";

const METRICS: DailyMetric[] = [
  "BUSINESS_IMPRESSIONS_DESKTOP_MAPS",
  "BUSINESS_IMPRESSIONS_DESKTOP_SEARCH",
  "BUSINESS_IMPRESSIONS_MOBILE_MAPS",
  "BUSINESS_IMPRESSIONS_MOBILE_SEARCH",
  "CALL_CLICKS",
  "WEBSITE_CLICKS",
  "BUSINESS_DIRECTION_REQUESTS",
];

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return {
    year: d.getFullYear(),
    month: d.getMonth() + 1,
    day: d.getDate(),
  };
}

export default async function RaportyPage() {
  try {
    const profile = await getActiveGbpProfile();
    const token = await getGbpAccessTokenForProfile(profile);
    const end = daysAgo(1);
    const start = daysAgo(30);

    let series: Array<{ metric: DailyMetric; label: string; total: number }> =
      METRICS.map((metric) => ({
        metric,
        label: metric,
        total: 0,
      }));

    try {
      const payload = await fetchGbpMultiDailyMetrics(
        token,
        profile.gbpLocationId!,
        METRICS,
        start,
        end,
      );
      const parsed = parsePerformancePayload(payload);
      if (parsed.length > 0) series = parsed;
    } catch {
      // Keep zeroed KPI cards when Performance API is unavailable
    }

    const rangeLabel = `${start.day}.${start.month}.${start.year} - ${end.day}.${end.month}.${end.year}`;
    return <RaportyView series={series} rangeLabel={rangeLabel} />;
  } catch (error) {
    if (error instanceof GbpNotConnectedError) return null;
    throw error;
  }
}
