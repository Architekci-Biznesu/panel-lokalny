"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  buildWeeklyActionsRows,
  buildWeeklyViewsRows,
  formatIntPl,
  REPORT_COLORS,
  type MetricSeries,
} from "@/features/wizytowka/performance";

function formatTick(iso: string) {
  const [, m, d] = iso.split("-");
  return `${Number(d)}.${Number(m)}`;
}

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
          <span>
            {item.label} {formatIntPl(item.value)}
          </span>
        </li>
      ))}
    </ul>
  );
}

function ViewsChart({ series }: { series: MetricSeries[] }) {
  const data = buildWeeklyViewsRows(series);
  const mapsTotal = data.reduce((sum, row) => sum + row.maps, 0);
  const searchTotal = data.reduce((sum, row) => sum + row.search, 0);
  const hasData = mapsTotal + searchTotal > 0;

  return (
    <section className="ui-kpi wiz-report-chart">
      <h3 className="wiz-field-label">Wyświetlenia tygodniowo</h3>
      {hasData ? (
        <>
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
          <div className="wiz-report-chart-body">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart
                data={data}
                margin={{ top: 8, right: 4, left: 0, bottom: 0 }}
                barCategoryGap="18%"
              >
                <CartesianGrid
                  stroke="var(--border)"
                  vertical={false}
                  strokeDasharray="0"
                />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatTick}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  minTickGap={28}
                />
                <YAxis
                  allowDecimals={false}
                  width={36}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: "var(--secondary)" }}
                  contentStyle={{
                    borderRadius: "var(--radius)",
                    border: "1px solid var(--border)",
                    fontSize: 12,
                  }}
                  labelFormatter={(label) => formatTick(String(label))}
                  formatter={(value, name) => [
                    formatIntPl(Number(value ?? 0)),
                    name === "maps" ? "Mapy" : "Wyszukiwarka",
                  ]}
                />
                <Bar
                  dataKey="maps"
                  stackId="views"
                  fill={REPORT_COLORS.maps}
                  maxBarSize={28}
                />
                <Bar
                  dataKey="search"
                  stackId="views"
                  fill={REPORT_COLORS.search}
                  maxBarSize={28}
                  radius={[3, 3, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      ) : (
        <p className="locked-note wiz-tab-note">Brak danych w wybranym okresie</p>
      )}
    </section>
  );
}

function ActionsChart({ series }: { series: MetricSeries[] }) {
  const data = buildWeeklyActionsRows(series);
  const directionsTotal = data.reduce((sum, row) => sum + row.directions, 0);
  const callsTotal = data.reduce((sum, row) => sum + row.calls, 0);
  const websiteTotal = data.reduce((sum, row) => sum + row.website, 0);
  const hasData = directionsTotal + callsTotal + websiteTotal > 0;

  return (
    <section className="ui-kpi wiz-report-chart">
      <h3 className="wiz-field-label">Akcje tygodniowo</h3>
      {hasData ? (
        <>
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
          <div className="wiz-report-chart-body">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart
                data={data}
                margin={{ top: 8, right: 4, left: 0, bottom: 0 }}
                barCategoryGap="18%"
              >
                <CartesianGrid
                  stroke="var(--border)"
                  vertical={false}
                  strokeDasharray="0"
                />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatTick}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  minTickGap={28}
                />
                <YAxis
                  allowDecimals={false}
                  width={36}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: "var(--secondary)" }}
                  contentStyle={{
                    borderRadius: "var(--radius)",
                    border: "1px solid var(--border)",
                    fontSize: 12,
                  }}
                  labelFormatter={(label) => formatTick(String(label))}
                  formatter={(value, name) => [
                    formatIntPl(Number(value ?? 0)),
                    name === "directions"
                      ? "Dojazd"
                      : name === "calls"
                        ? "Telefon"
                        : "Witryna",
                  ]}
                />
                <Bar
                  dataKey="directions"
                  stackId="actions"
                  fill={REPORT_COLORS.directions}
                  maxBarSize={28}
                />
                <Bar
                  dataKey="calls"
                  stackId="actions"
                  fill={REPORT_COLORS.calls}
                  maxBarSize={28}
                />
                <Bar
                  dataKey="website"
                  stackId="actions"
                  fill={REPORT_COLORS.website}
                  maxBarSize={28}
                  radius={[3, 3, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      ) : (
        <p className="locked-note wiz-tab-note">Brak danych w wybranym okresie</p>
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
