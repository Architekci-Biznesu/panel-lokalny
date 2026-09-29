import Link from "next/link";
import { ArrowUpRight, CalendarDays } from "lucide-react";
import { ImproveCard } from "@/features/pulpit/improve-card";
import { NewReviewsCard } from "@/features/pulpit/new-reviews-card";
import { RankPhrasesCard } from "@/features/pulpit/rank-phrases-card";
import { RecentPublicationsCard } from "@/features/pulpit/recent-publications-card";
import { ReportKpiStrip } from "@/features/pulpit/report-kpi-strip";
import { VisibilityCard } from "@/features/pulpit/visibility-card";
import type { PulpitPayload } from "@/features/pulpit/load-pulpit";

export function PulpitView({ data }: { data: PulpitPayload }) {
  return (
    <div className="pulpit-page">
      <div className="page-header">
        <div>
          <h1>Pulpit</h1>
          <p>Skrót raportu wizytówki i rzeczy do poprawy.</p>
        </div>
        <div className="pulpit-header-actions">
          <span className="pulpit-range mono">
            <CalendarDays aria-hidden />
            {data.reportRangeLabel ?? "Ostatnie 30 dni"}
          </span>
          <Link
            href="/wizytowka/raporty"
            className="ui-btn ui-btn-outline ui-btn-sm"
          >
            Pełny raport
            <ArrowUpRight aria-hidden />
          </Link>
        </div>
      </div>

      {!data.connected ? (
        <p className="locked-note">
          Ten profil nie ma podłączonej wizytówki Google.{" "}
          <Link href="/ustawienia/integracje" className="wiz-inline-link">
            Połącz w integracjach
          </Link>
          .
        </p>
      ) : null}

      {data.loadError ? <p className="locked-note">{data.loadError}</p> : null}

      <ReportKpiStrip summary={data.reportSummary} reviews={data.reviews} />

      <div className="pulpit-grid">
        <div className="pulpit-main">
          <VisibilityCard visibility={data.monthVisibility} />
          <RankPhrasesCard phrases={data.rankPhrases} />
        </div>

        <aside className="pulpit-side">
          <ImproveCard
            improve={data.improve}
            proposals={data.proposals}
            proposalsTotal={data.proposalsTotal}
          />
          <NewReviewsCard reviews={data.reviews} />
          <RecentPublicationsCard publications={data.publications} />
        </aside>
      </div>
    </div>
  );
}
