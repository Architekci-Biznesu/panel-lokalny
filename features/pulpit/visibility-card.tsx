"use client";

import { Eye } from "lucide-react";
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

  return (
    <section className="pulpit-card pulpit-visibility">
      <header className="pulpit-card-head">
        <div className="pulpit-visibility-title-row">
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
      </header>

      {!hasData || !visibility ? (
        <p className="pulpit-empty">
          Brak danych o wyświetleniach w ostatnim miesiącu.
        </p>
      ) : (
        <div className="pulpit-month-body">
          <div className="pulpit-month-summary">
            <p className="pulpit-month-total mono">
              {formatIntPl(visibility.total)}
            </p>
            <p className="pulpit-card-lead">Wyświetlenia łącznie</p>
            {change != null && visibility.compareLabel ? (
              <>
                <p
                  className={`pulpit-month-change mono${change < 0 ? " is-down" : ""}${change > 0 ? " is-up" : ""}`}
                >
                  {changeLabel}
                </p>
                <p className="pulpit-card-lead">{visibility.compareLabel}</p>
              </>
            ) : null}
          </div>

          <div className="pulpit-month-chart">
            <ResponsiveContainer width="100%" height={220}>
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
                      stopOpacity={0.28}
                    />
                    <stop
                      offset="100%"
                      stopColor={REPORT_COLORS.maps}
                      stopOpacity={0.02}
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
                  cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid var(--border)",
                    background: "var(--card)",
                    fontSize: 12,
                  }}
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
