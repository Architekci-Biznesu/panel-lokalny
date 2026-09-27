"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  BarXAxis,
  ChartTooltip,
  Grid,
} from "@/components/charts";
import {
  buildWeeklyActionsRows,
  buildWeeklyViewsRows,
  formatIntPl,
  REPORT_COLORS,
  type MetricSeries,
} from "@/features/wizytowka/performance";

const WEEK_FMT = new Intl.DateTimeFormat("pl-PL", {
  day: "numeric",
  month: "short",
});

/** "2026-09-07" -> "7 wrz" (początek tygodnia). */
function weekLabel(iso: string) {
  return WEEK_FMT.format(new Date(`${iso}T12:00:00`));
}

/** Wspólne ustawienia słupków tygodniowych (Bklit BarChart, stos). */
const CHART_MARGIN = { top: 16, right: 8, bottom: 32, left: 8 };
/** Odstęp między segmentami stosu - dzięki niemu każdy segment ma zaokrąglone rogi, nie tylko górny. */
const STACK_GAP = 3;

function ChartLegend({
  items,
}: {
  items: Array<{ label: string; value: number; color: string }>;
}) {
  return (
    <ul className="wiz-report-legend">
      {items.map((item) => (
        <li key={item.label}>
          <span
            className="wiz-report-legend-swatch"
            style={{ background: item.color }}
          />
          <span className="wiz-report-legend-label">{item.label}</span>
          <span className="wiz-report-legend-value mono">
            {formatIntPl(item.value)}
          </span>
        </li>
      ))}
    </ul>
  );
}

function ViewsChart({ series }: { series: MetricSeries[] }) {
  const data = useMemo(() => buildWeeklyViewsRows(series), [series]);
  const chartData = useMemo(
    () => data.map((row) => ({ ...row, week: weekLabel(row.date) })),
    [data],
  );
  const mapsTotal = data.reduce((sum, row) => sum + row.maps, 0);
  const searchTotal = data.reduce((sum, row) => sum + row.search, 0);
  const hasData = mapsTotal + searchTotal > 0;

  return (
    <section className="ui-kpi wiz-report-chart">
      <div className="wiz-report-chart-head">
        <h3 className="wiz-report-chart-title">Wyświetlenia tygodniowo</h3>
        {hasData ? (
          <ChartLegend
            items={[
              {
                label: "Mapy",
                value: mapsTotal,
                color: REPORT_COLORS.maps,
              },
              {
                label: "Wyszukiwarka",
                value: searchTotal,
                color: REPORT_COLORS.search,
              },
            ]}
          />
        ) : null}
      </div>
      {hasData ? (
        <div className="wiz-report-chart-body">
          <BarChart
            data={chartData}
            xDataKey="week"
            stacked
            stackGap={STACK_GAP}
            barGap={0.35}
            aspectRatio="auto"
            className="wiz-report-bars-chart"
            margin={CHART_MARGIN}
          >
            <Grid horizontal numTicksRows={4} />
            <Bar
              dataKey="maps"
              fill={REPORT_COLORS.maps}
              lineCap={4}
              stackGap={STACK_GAP}
            />
            <Bar
              dataKey="search"
              fill={REPORT_COLORS.search}
              lineCap={4}
              stackGap={STACK_GAP}
            />
            <BarXAxis maxLabels={8} />
            <ChartTooltip
              rows={(point) => [
                {
                  color: REPORT_COLORS.maps,
                  label: "Mapy",
                  value: formatIntPl(Number(point.maps ?? 0)),
                },
                {
                  color: REPORT_COLORS.search,
                  label: "Wyszukiwarka",
                  value: formatIntPl(Number(point.search ?? 0)),
                },
              ]}
            />
          </BarChart>
        </div>
      ) : (
        <p className="locked-note wiz-tab-note">
          Brak danych w wybranym okresie
        </p>
      )}
    </section>
  );
}

function ActionsChart({ series }: { series: MetricSeries[] }) {
  const data = useMemo(() => buildWeeklyActionsRows(series), [series]);
  const chartData = useMemo(
    () => data.map((row) => ({ ...row, week: weekLabel(row.date) })),
    [data],
  );
  const directionsTotal = data.reduce((sum, row) => sum + row.directions, 0);
  const callsTotal = data.reduce((sum, row) => sum + row.calls, 0);
  const websiteTotal = data.reduce((sum, row) => sum + row.website, 0);
  const hasData = directionsTotal + callsTotal + websiteTotal > 0;

  return (
    <section className="ui-kpi wiz-report-chart">
      <div className="wiz-report-chart-head">
        <h3 className="wiz-report-chart-title">Akcje tygodniowo</h3>
        {hasData ? (
          <ChartLegend
            items={[
              {
                label: "Dojazd",
                value: directionsTotal,
                color: REPORT_COLORS.directions,
              },
              {
                label: "Telefon",
                value: callsTotal,
                color: REPORT_COLORS.calls,
              },
              {
                label: "Witryna",
                value: websiteTotal,
                color: REPORT_COLORS.website,
              },
            ]}
          />
        ) : null}
      </div>
      {hasData ? (
        <div className="wiz-report-chart-body">
          <BarChart
            data={chartData}
            xDataKey="week"
            stacked
            stackGap={STACK_GAP}
            barGap={0.35}
            aspectRatio="auto"
            className="wiz-report-bars-chart"
            margin={CHART_MARGIN}
          >
            <Grid horizontal numTicksRows={4} />
            <Bar
              dataKey="directions"
              fill={REPORT_COLORS.directions}
              lineCap={4}
              stackGap={STACK_GAP}
            />
            <Bar
              dataKey="calls"
              fill={REPORT_COLORS.calls}
              lineCap={4}
              stackGap={STACK_GAP}
            />
            <Bar
              dataKey="website"
              fill={REPORT_COLORS.website}
              lineCap={4}
              stackGap={STACK_GAP}
            />
            <BarXAxis maxLabels={8} />
            <ChartTooltip
              rows={(point) => [
                {
                  color: REPORT_COLORS.directions,
                  label: "Dojazd",
                  value: formatIntPl(Number(point.directions ?? 0)),
                },
                {
                  color: REPORT_COLORS.calls,
                  label: "Telefon",
                  value: formatIntPl(Number(point.calls ?? 0)),
                },
                {
                  color: REPORT_COLORS.website,
                  label: "Witryna",
                  value: formatIntPl(Number(point.website ?? 0)),
                },
              ]}
            />
          </BarChart>
        </div>
      ) : (
        <p className="locked-note wiz-tab-note">
          Brak danych w wybranym okresie
        </p>
      )}
    </section>
  );
}

export function RaportyCharts({ series }: { series: MetricSeries[] }) {
  return (
    <div className="wiz-report-charts">
      <ViewsChart series={series} />
      <ActionsChart series={series} />
    </div>
  );
}
