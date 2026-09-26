import Link from "next/link";
import { ImproveCard } from "@/features/pulpit/improve-card";
import { ProposalsSummaryCard } from "@/features/pulpit/proposals-summary-card";
import { RankSnapshotCard } from "@/features/pulpit/rank-snapshot-card";
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

      <div className="pulpit-grid">
        <div className="pulpit-span-12">
          <ReportKpiStrip
            summary={data.reportSummary}
            rangeLabel={data.reportRangeLabel}
          />
        </div>

        <div className="pulpit-span-12">
          <VisibilityCard visibility={data.visibility} />
        </div>

        <div className="pulpit-span-12">
          <RankSnapshotCard rank={data.rank} />
        </div>

        <div className="pulpit-span-6">
          <ImproveCard improve={data.improve} />
        </div>

        <div className="pulpit-span-6">
          <ProposalsSummaryCard
            proposals={data.proposals}
            proposalsTotal={data.proposalsTotal}
          />
        </div>
      </div>
    </div>
  );
}
