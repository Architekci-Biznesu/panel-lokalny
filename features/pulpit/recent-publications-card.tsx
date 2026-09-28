import Link from "next/link";
import { ArrowUpRight, ChevronRight, FileText } from "lucide-react";
import { CHANNEL_LABELS } from "@/features/publikacje/content-status";
import type { PulpitPublication } from "@/features/pulpit/load-pulpit";

const DATE_FMT = new Intl.DateTimeFormat("pl-PL", {
  day: "numeric",
  month: "short",
  timeZone: "Europe/Warsaw",
});

/** Pulpit tile: latest posts actually published (content_targets = published). */
export function RecentPublicationsCard({
  publications,
}: {
  publications: PulpitPublication[];
}) {
  return (
    <section className="pulpit-card">
      <header className="pulpit-card-head">
        <div className="pulpit-title-row">
          <span className="pulpit-icon-circle is-dark" aria-hidden>
            <FileText />
          </span>
          <div>
            <h2 className="pulpit-card-title">Ostatnie publikacje</h2>
            <p className="pulpit-card-lead">Posty opublikowane w Google.</p>
          </div>
        </div>
      </header>

      {publications.length === 0 ? (
        <p className="pulpit-empty">
          Jeszcze nic nie zostało opublikowane.{" "}
          <Link href="/publikacje?status=pending" className="wiz-inline-link">
            Zobacz propozycje AI
          </Link>
          .
        </p>
      ) : (
        <ul className="pulpit-action-list">
          {publications.map((item) => (
            <li key={item.targetId}>
              <Link
                href="/publikacje?status=published"
                className="pulpit-action-row"
              >
                <span className="pulpit-action-icon is-published" aria-hidden>
                  <FileText />
                </span>
                <span className="pulpit-action-copy">
                  <span className="pulpit-action-title">{item.title}</span>
                  <span className="pulpit-action-meta">
                    {CHANNEL_LABELS[item.channel]} ·{" "}
                    <span className="mono">
                      {item.date ? DATE_FMT.format(item.date) : "-"}
                    </span>
                  </span>
                </span>
                <ChevronRight aria-hidden className="pulpit-action-go" />
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Link href="/publikacje?status=all" className="pulpit-card-foot">
        Zobacz wszystkie
        <ArrowUpRight aria-hidden />
      </Link>
    </section>
  );
}
