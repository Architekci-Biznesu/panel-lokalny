"use client";

import { Eye, TrendingDown, TrendingUp } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { PulpitMonthVisibility } from "@/features/pulpit/load-pulpit";
import { formatIntPl, REPORT_COLORS } from "@/features/wizytowka/performance";

function formatTick(iso: string) {
  const [, m, d] = iso.split("-");
  return `${Number(d)}.${Number(m)}`;
}

const AXIS_TICK = {
  fill: "var(--muted-foreground)",
  fontSize: 11,
  fontFamily: "var(--font-mono), ui-monospace, monospace",
};

export function VisibilityCard({
  visibility,
}: {
  visibility: PulpitMonthVisibility | null;
}) {
  const days = visibility?.days ?? [];
  const hasData = days.some((d) => d.value > 0);
  const change = visibility?.changePct ?? null;
  const changeLabel =
    change == null
      ? "-"
      : `${change >= 0 ? "+" : ""}${Math.round(change).toLocaleString("pl-PL")}%`;

  const hasSummary = hasData && visibility != null;

  return (
    <section className="pulpit-card pulpit-visibility">
      <header className="pulpit-card-head">
        <div className="pulpit-title-row">
          <span className="pulpit-icon-circle" aria-hidden>
            <Eye />
          </span>
          <div>
            <h2 className="pulpit-card-title">Widoczność wizytówki</h2>
            <p className="pulpit-card-lead">
              Wyświetlenia w Google z ostatnich 30 dni.
            </p>
          </div>
        </div>
        {hasSummary ? (
          <div className="pulpit-month-summary">
            <p className="pulpit-month-label">Wyświetlenia łącznie</p>
            <p className="pulpit-month-total mono">
              {formatIntPl(visibility.total)}
            </p>
            {change != null && visibility.compareLabel ? (
              <p className="pulpit-month-compare">
                <span
                  className={`ui-pill mono${change > 0 ? " ui-pill-success" : ""}${change < 0 ? " ui-pill-danger" : ""}`}
                >
                  {change < 0 ? (
                    <TrendingDown aria-hidden />
                  ) : (
                    <TrendingUp aria-hidden />
                  )}
                  {changeLabel}
                </span>
                {visibility.compareLabel}
              </p>
            ) : null}
          </div>
        ) : null}
      </header>

      {!hasSummary ? (
        <p className="pulpit-empty">
          Brak danych o wyświetleniach w ostatnim miesiącu.
        </p>
      ) : (
        <div className="pulpit-month-body">
          <div className="pulpit-month-chart">
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart
                data={days}
                margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient
                    id="pulpitViewsFill"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="0%"
                      stopColor={REPORT_COLORS.maps}
                      stopOpacity={0.22}
                    />
                    <stop
                      offset="100%"
                      stopColor={REPORT_COLORS.maps}
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  stroke="var(--border)"
                  vertical={false}
                  strokeDasharray="0"
                />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatTick}
                  tick={AXIS_TICK}
                  axisLine={false}
                  tickLine={false}
                  minTickGap={36}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={AXIS_TICK}
                  axisLine={false}
                  tickLine={false}
                  width={36}
                  allowDecimals={false}
                />
                <Tooltip
                  cursor={{
                    stroke: "var(--brand-soft)",
                    strokeWidth: 1,
                    strokeDasharray: "4 4",
                  }}
                  contentStyle={{
                    borderRadius: 12,
                    border: 0,
                    background: "var(--primary)",
                    boxShadow: "var(--shadow-pop)",
                    padding: "8px 12px",
                    fontSize: 12,
                  }}
                  labelStyle={{
                    color: "var(--primary-foreground)",
                    opacity: 0.7,
                    marginBottom: 2,
                  }}
                  itemStyle={{ color: "var(--primary-foreground)", padding: 0 }}
                  labelFormatter={(label) => formatTick(String(label))}
                  formatter={(value) => [
                    formatIntPl(Number(value ?? 0)),
                    "Wyświetlenia",
                  ]}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={REPORT_COLORS.maps}
                  strokeWidth={2}
                  fill="url(#pulpitViewsFill)"
                  activeDot={{
                    r: 5,
                    fill: REPORT_COLORS.maps,
                    stroke: "var(--card)",
                    strokeWidth: 2,
                  }}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </section>
  );
}
