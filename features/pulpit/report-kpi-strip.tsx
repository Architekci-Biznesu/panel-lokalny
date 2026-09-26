import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import {
  formatIntPl,
  formatRatePl,
  type ReportBreakdownRow,
  type ReportSummary,
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
      {rows.map((row) => {
        const pct = Math.round((row.value / max) * 100);
        return (
          <li key={row.key} className="wiz-report-bar-row">
            <div className="wiz-report-bar-meta">
              <span className="wiz-report-bar-label">{row.label}</span>
              <span className="wiz-report-bar-value mono">
                {formatIntPl(row.value)}{" "}
                <span className="wiz-report-bar-pct">{pct}%</span>
              </span>
            </div>
            <span className="wiz-report-bar-track">
              <span
                className="wiz-report-bar-fill"
                style={{
                  width: `${(row.value / max) * 100}%`,
                  background: row.color,
                }}
              />
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function RateTicks({ value }: { value: number }) {
  const total = 20;
  const filled = Math.max(
    0,
    Math.min(total, Math.round((value / 100) * total)),
  );
  return (
    <div className="wiz-complete-bar wiz-report-rate-ticks" aria-hidden>
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={`wiz-complete-tick${i < filled ? " is-on" : ""}`}
        />
      ))}
    </div>
  );
}

export function ReportKpiStrip({
  summary,
  rangeLabel,
}: {
  summary: ReportSummary | null;
  rangeLabel: string | null;
}) {
  const hasData =
    summary != null && (summary.viewsTotal > 0 || summary.actionsTotal > 0);
  const mobilePct =
    summary && summary.viewsTotal > 0
      ? Math.round((summary.mobileViews / summary.viewsTotal) * 100)
      : 0;
  const desktopPct =
    summary && summary.viewsTotal > 0
      ? Math.round((summary.desktopViews / summary.viewsTotal) * 100)
      : 0;
  const rateRounded = summary ? Math.round(summary.actionsPer100) : 0;

  return (
    <section className="pulpit-section">
      <header className="pulpit-card-head">
        <div>
          <h2 className="pulpit-card-title">Statystyki wizytówki</h2>
          <p className="pulpit-card-lead mono">
            {rangeLabel ?? "Ostatnie 30 dni"}
          </p>
        </div>
        <Link href="/wizytowka/raporty" className="pulpit-card-cta">
          Pełny raport
          <ArrowUpRight aria-hidden />
        </Link>
      </header>

      {!hasData || !summary ? (
        <p className="pulpit-empty">Brak danych o widoczności w tym okresie.</p>
      ) : (
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
            <RateTicks value={summary.actionsPer100} />
          </div>
        </div>
      )}
    </section>
  );
}
