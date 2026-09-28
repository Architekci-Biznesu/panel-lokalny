import { ArrowUpRight, CircleAlert } from "lucide-react";
import Link from "next/link";
import {
  TargetStatusPill,
  formatPubDate,
  formatPubDateTime,
} from "@/features/publikacje/components/content-status-pill";
import { GenerateProposalButton } from "@/features/publikacje/components/generate-proposal-button";
import { CHANNEL_LABELS } from "@/features/publikacje/content-status";
import {
  loadOverview,
  type OverviewTarget,
} from "@/features/publikacje/load-overview";
import { getActiveProfile } from "@/lib/session";

function TargetRows({
  rows,
  empty,
}: {
  rows: OverviewTarget[];
  empty: string;
}) {
  if (rows.length === 0) return <p className="pub-empty-line">{empty}</p>;
  return (
    <ul className="pub-list">
      {rows.map((row) => (
        <li key={row.targetId} className="pub-list-row">
          <div className="pub-list-main">
            <p className="pub-list-title">{row.title}</p>
            <p className="pub-list-meta">
              {CHANNEL_LABELS[row.channel]} ·{" "}
              <span className="mono">
                {row.status === "scheduled"
                  ? formatPubDateTime(row.date)
                  : formatPubDate(row.date)}
              </span>
              {row.error ? ` · ${row.error}` : ""}
            </p>
          </div>
          <TargetStatusPill status={row.status} />
        </li>
      ))}
    </ul>
  );
}

export default async function PublikacjePage() {
  const profile = await getActiveProfile();
  const data = await loadOverview(profile);

  return (
    <div className="pub-stack">
      {data.failed.length ? (
        <section className="ui-section pub-overview-alert" role="note">
          <CircleAlert aria-hidden />
          <div>
            <p className="pub-overview-alert-title">
              Nie wszystko się opublikowało
            </p>
            <p className="pub-overview-alert-text">
              {data.failed[0].title}: {data.failed[0].error}
            </p>
          </div>
          <Link
            href="/publikacje/wszystkie?status=failed"
            className="ui-btn ui-btn-white ui-btn-sm"
          >
            Zobacz błędy
          </Link>
        </section>
      ) : null}

      <div className="pub-overview-grid">
        <section className="ui-section pub-overview-card">
          <header className="pub-overview-head">
            <h2 className="pub-overview-title">Czeka na akceptację</h2>
            <span className="pub-overview-count mono">{data.pendingCount}</span>
          </header>
          {data.pending.length ? (
            <ul className="pub-list">
              {data.pending.map((item) => (
                <li key={item.id} className="pub-list-row">
                  <div className="pub-list-main">
                    <p className="pub-list-title">{item.title}</p>
                    <p className="pub-list-meta mono">
                      {formatPubDate(item.createdAt)}
                    </p>
                  </div>
                  <span className="ui-pill ui-pill-warn">Do akceptacji</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="pub-empty-line">
              Brak propozycji. Poproś AI o nowy post.
            </p>
          )}
          <div className="pub-overview-actions">
            {data.pendingCount ? (
              <Link
                href="/publikacje/inbox"
                className="ui-btn ui-btn-primary ui-btn-sm"
              >
                Przejrzyj propozycje
                <ArrowUpRight aria-hidden />
              </Link>
            ) : (
              <GenerateProposalButton variant="white" />
            )}
          </div>
        </section>

        <section className="ui-section pub-overview-card">
          <header className="pub-overview-head">
            <h2 className="pub-overview-title">Zaplanowane</h2>
            <span className="pub-overview-count mono">
              {data.scheduled.length}
            </span>
          </header>
          <TargetRows
            rows={data.scheduled}
            empty="Nic nie jest zaplanowane. Przy akceptacji możesz wybrać datę publikacji."
          />
          <div className="pub-overview-actions">
            <Link
              href="/publikacje/kalendarz"
              className="ui-btn ui-btn-white ui-btn-sm"
            >
              Kalendarz
              <ArrowUpRight aria-hidden />
            </Link>
          </div>
        </section>
      </div>

      <section className="ui-section pub-overview-card">
        <header className="pub-overview-head">
          <h2 className="pub-overview-title">Ostatnio opublikowane</h2>
          <Link href="/publikacje/wszystkie" className="pub-overview-link">
            Zobacz wszystkie
          </Link>
        </header>
        <TargetRows
          rows={data.published}
          empty="Jeszcze nic nie zostało opublikowane."
        />
      </section>
    </div>
  );
}
