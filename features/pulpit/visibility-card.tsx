"use client";

import { Eye, TrendingDown, TrendingUp } from "lucide-react";
import { useMemo } from "react";
import {
  Area,
  AreaChart,
  ChartTooltip,
  Grid,
  XAxis,
} from "@/components/charts";
import type { PulpitMonthVisibility } from "@/features/pulpit/load-pulpit";
import { formatIntPl } from "@/features/wizytowka/performance";

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

  // Bklit oczekuje obiektów Date na osi X (dni z API przychodzą jako "YYYY-MM-DD").
  const chartData = useMemo(
    () =>
      (visibility?.days ?? []).map((d) => ({
        date: new Date(`${d.date}T12:00:00`),
        value: d.value,
      })),
    [visibility],
  );

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
            <AreaChart
              data={chartData}
              aspectRatio="auto"
              style={{ height: 240 }}
              margin={{ top: 16, right: 20, bottom: 32, left: 20 }}
            >
              <Grid horizontal numTicksRows={4} />
              <Area
                dataKey="value"
                fill="var(--chart-line-primary)"
                strokeWidth={2}
                fillOpacity={0.25}
              />
              <XAxis numTicks={6} />
              <ChartTooltip
                rows={(point) => [
                  {
                    color: "var(--chart-line-primary)",
                    label: "Wyświetlenia",
                    value: formatIntPl(Number(point.value ?? 0)),
                  },
                ]}
              />
            </AreaChart>
          </div>
        </div>
      )}
    </section>
  );
}
