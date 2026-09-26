import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import {
  formatIntPl,
  formatRatePl,
  type ReportSummary,
} from "@/features/wizytowka/performance";

export function ReportKpiStrip({
  summary,
  rangeLabel,
}: {
  summary: ReportSummary | null;
  rangeLabel: string | null;
}) {
  const hasData =
    summary != null && (summary.viewsTotal > 0 || summary.actionsTotal > 0);

  return (
    <section className="pulpit-card pulpit-kpi-strip">
      <header className="pulpit-card-head">
        <div>
          <h2 className="pulpit-card-title">Statystyki wizytówki</h2>
          <p className="pulpit-card-lead">
            {rangeLabel
              ? `Ostatnie 30 dni · ${rangeLabel}`
              : "Ostatnie 30 dni w Google Business Profile."}
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
        <div className="pulpit-kpi-grid">
          <div className="pulpit-kpi">
            <p className="pulpit-kpi-label">Wyświetlenia</p>
            <p className="pulpit-kpi-value mono">
              {formatIntPl(summary.viewsTotal)}
            </p>
            <p className="pulpit-kpi-foot mono">
              Mapy {formatIntPl(summary.viewsBreakdown[0]?.value ?? 0)} ·
              Wyszukiwarka {formatIntPl(summary.viewsBreakdown[1]?.value ?? 0)}
            </p>
          </div>
          <div className="pulpit-kpi">
            <p className="pulpit-kpi-label">Akcje klientów</p>
            <p className="pulpit-kpi-value mono">
              {formatIntPl(summary.actionsTotal)}
            </p>
            <p className="pulpit-kpi-foot mono">
              Dojazd {formatIntPl(summary.actionsBreakdown[0]?.value ?? 0)} ·
              Telefon {formatIntPl(summary.actionsBreakdown[1]?.value ?? 0)} ·
              Witryna {formatIntPl(summary.actionsBreakdown[2]?.value ?? 0)}
            </p>
          </div>
          <div className="pulpit-kpi">
            <p className="pulpit-kpi-label">Akcje na 100 wyświetleń</p>
            <p className="pulpit-kpi-value mono">
              {formatRatePl(summary.actionsPer100)}
            </p>
            <p className="pulpit-kpi-foot">
              Ok. {Math.round(summary.actionsPer100)} reakcji na 100 wyświetleń.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
