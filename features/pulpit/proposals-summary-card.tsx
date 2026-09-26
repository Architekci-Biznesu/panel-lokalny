import Link from "next/link";
import { ArrowUpRight, Sparkles } from "lucide-react";
import type { PulpitProposalItem } from "@/features/pulpit/load-pulpit";

export function ProposalsSummaryCard({
  proposals,
  proposalsTotal,
}: {
  proposals: PulpitProposalItem[];
  proposalsTotal: number;
}) {
  return (
    <section className="pulpit-card pulpit-proposals">
      <header className="pulpit-card-head">
        <div className="pulpit-visibility-title-row">
          <span className="pulpit-icon-circle" aria-hidden>
            <Sparkles />
          </span>
          <div>
            <h2 className="pulpit-card-title">Propozycje AI</h2>
            <p className="pulpit-card-lead">
              {proposalsTotal > 0
                ? `${proposalsTotal} ${
                    proposalsTotal === 1
                      ? "propozycja czeka"
                      : proposalsTotal < 5
                        ? "propozycje czekają"
                        : "propozycji czeka"
                  } na decyzję.`
                : "Brak oczekujących propozycji."}
            </p>
          </div>
        </div>
        <Link href="/wizytowka/informacje" className="pulpit-card-cta">
          Zobacz na Wizytówce
          <ArrowUpRight aria-hidden />
        </Link>
      </header>

      {proposals.length === 0 ? (
        <p className="pulpit-empty">
          Gdy AI zaproponuje zmiany, zobaczysz je tutaj w skrócie.
        </p>
      ) : (
        <ul className="pulpit-action-list">
          {proposals.map((item) => (
            <li key={item.id}>
              <Link href={item.href} className="pulpit-action-row">
                <span className="pulpit-action-title">{item.label}</span>
                <span className="pulpit-action-meta">{item.hint}</span>
              </Link>
            </li>
          ))}
          {proposalsTotal > proposals.length ? (
            <li>
              <Link
                href="/wizytowka/informacje"
                className="pulpit-action-row is-more"
              >
                <span className="pulpit-action-title">
                  +{proposalsTotal - proposals.length} więcej na Wizytówce
                </span>
              </Link>
            </li>
          ) : null}
        </ul>
      )}
    </section>
  );
}
