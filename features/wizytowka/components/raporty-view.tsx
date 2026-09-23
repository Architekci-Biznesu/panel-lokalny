"use client";

import { DateRangePicker } from "@/features/wizytowka/components/date-range-picker";
import { RaportyCharts } from "@/features/wizytowka/components/raporty-charts";
import {
  buildReportSummary,
  formatDatePl,
  formatIntPl,
  formatRatePl,
  type DateParts,
  type MetricSeries,
  type ReportBreakdownRow,
} from "@/features/wizytowka/performance";

function BreakdownBars({
  rows,
  total,
}: {
  rows: ReportBreakdownRow[];
  total: number;
}) {
  const max = Math.max(total, 1);
  return (
    <ul className="wiz-report-bars">
      {rows.map((row) => (
        <li key={row.key} className="wiz-report-bar-row">
          <span className="wiz-report-bar-label">{row.label}</span>
          <span className="wiz-report-bar-track">
            <span
              className="wiz-report-bar-fill"
              style={{
                width: `${(row.value / max) * 100}%`,
                background: row.color,
              }}
            />
          </span>
          <span className="wiz-report-bar-value mono">{formatIntPl(row.value)}</span>
        </li>
      ))}
    </ul>
  );
}

export function RaportyView({
  series,
  start,
  end,
  loadError = false,
}: {
  series: MetricSeries[];
  start: DateParts;
  end: DateParts;
  loadError?: boolean;
}) {
  const summary = buildReportSummary(series);
  const rangeLabel = `${formatDatePl(start)} - ${formatDatePl(end)}`;
  const mobilePct =
    summary.viewsTotal > 0
      ? Math.round((summary.mobileViews / summary.viewsTotal) * 100)
      : 0;
  const desktopPct =
    summary.viewsTotal > 0
      ? Math.round((summary.desktopViews / summary.viewsTotal) * 100)
      : 0;
  const rateRounded = Math.round(summary.actionsPer100);

  return (
    <div className="wiz-stack">
      <div className="wiz-tab-head">
        <div className="wiz-tab-head-text">
          <h2 className="text-base font-semibold">Raporty wizytówki</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Dane z Google Business Profile · {rangeLabel}
          </p>
        </div>
        <DateRangePicker start={start} end={end} />
      </div>

      {loadError ? (
        <p className="locked-note">
          Nie udało się pobrać statystyk z Google. Spróbuj ponownie później.
        </p>
      ) : null}

      <div className="wiz-report-summary">
        <div className="ui-kpi wiz-report-kpi">
          <p className="wiz-report-kpi-label">Wyświetlenia wizytówki</p>
          <p className="wiz-report-kpi-value mono">
            {formatIntPl(summary.viewsTotal)}
          </p>
          <BreakdownBars
            rows={summary.viewsBreakdown}
            total={summary.viewsTotal}
          />
          <p className="wiz-report-kpi-foot mono">
            Mobile {formatIntPl(summary.mobileViews)} ({mobilePct}%) · Desktop{" "}
            {formatIntPl(summary.desktopViews)} ({desktopPct}%)
          </p>
        </div>

        <div className="ui-kpi wiz-report-kpi">
          <p className="wiz-report-kpi-label">Akcje klientów</p>
          <p className="wiz-report-kpi-value mono">
            {formatIntPl(summary.actionsTotal)}
          </p>
          <BreakdownBars
            rows={summary.actionsBreakdown}
            total={summary.actionsTotal}
          />
        </div>

        <div className="ui-kpi wiz-report-kpi">
          <p className="wiz-report-kpi-label">Akcje na 100 wyświetleń</p>
          <p className="wiz-report-kpi-value mono">
            {formatRatePl(summary.actionsPer100)}
          </p>
          <p className="wiz-report-kpi-desc">
            Na każde 100 wyświetleń przypada ok. {rateRounded} telefonów, tras
            lub wejść na stronę.
          </p>
        </div>
      </div>

      <RaportyCharts series={series} />
    </div>
  );
}
