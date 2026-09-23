import type { DailyMetric } from "@/lib/integrations/gbp/client";

export type MetricSeries = {
  metric: DailyMetric;
  label: string;
  total: number;
};

const METRIC_LABELS: Record<string, string> = {
  BUSINESS_IMPRESSIONS_DESKTOP_MAPS: "Wyświetlenia - mapy (desktop)",
  BUSINESS_IMPRESSIONS_DESKTOP_SEARCH: "Wyświetlenia - szukajka (desktop)",
  BUSINESS_IMPRESSIONS_MOBILE_MAPS: "Wyświetlenia - mapy (mobile)",
  BUSINESS_IMPRESSIONS_MOBILE_SEARCH: "Wyświetlenia - szukajka (mobile)",
  CALL_CLICKS: "Kliknięcia telefonu",
  WEBSITE_CLICKS: "Kliknięcia witryny",
  BUSINESS_DIRECTION_REQUESTS: "Prośby o dojazd",
};

export function RaportyView({
  series,
  rangeLabel,
}: {
  series: MetricSeries[];
  rangeLabel: string;
}) {
  return (
    <div className="wiz-stack">
      <div className="wiz-tab-head">
        <div>
          <h2 className="text-base font-semibold">Raporty wizytówki</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Dane z Google Business Profile Performance API · {rangeLabel}
          </p>
        </div>
      </div>
      <div className="wiz-tab-panel">
        <div className="wiz-kpi-grid">
          {series.map((item) => (
            <div key={item.metric} className="ui-kpi">
              <p className="text-sm text-muted-foreground">
                {METRIC_LABELS[item.metric] ?? item.label}
              </p>
              <p className="mt-2 text-2xl font-semibold mono">{item.total}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function parsePerformancePayload(payload: unknown): MetricSeries[] {
  const root = payload as {
    multiDailyMetricTimeSeries?: Array<{
      dailyMetricTimeSeries?: Array<{
        dailyMetric?: string;
        timeSeries?: {
          datedValues?: Array<{ value?: string }>;
        };
      }>;
    }>;
  };

  const out: MetricSeries[] = [];
  for (const block of root.multiDailyMetricTimeSeries ?? []) {
    for (const series of block.dailyMetricTimeSeries ?? []) {
      const metric = series.dailyMetric as DailyMetric | undefined;
      if (!metric) continue;
      const total = (series.timeSeries?.datedValues ?? []).reduce(
        (sum, point) => sum + Number(point.value ?? 0),
        0,
      );
      out.push({
        metric,
        label: METRIC_LABELS[metric] ?? metric,
        total,
      });
    }
  }
  return out;
}
