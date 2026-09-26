import Link from "next/link";
import { ArrowUpRight, CircleAlert, Sparkles } from "lucide-react";
import type {
  PulpitImproveGap,
  PulpitPayload,
  PulpitProposalItem,
} from "@/features/pulpit/load-pulpit";
import type { CompletenessCheck } from "@/features/wizytowka/completeness";

type ImproveEntry =
  | { kind: "ai"; item: PulpitProposalItem }
  | { kind: "check"; item: CompletenessCheck }
  | { kind: "gap"; item: PulpitImproveGap };

export function ImproveCard({
  improve,
  proposals,
  proposalsTotal,
}: {
  improve: PulpitPayload["improve"];
  proposals: PulpitProposalItem[];
  proposalsTotal: number;
}) {
  const entries: ImproveEntry[] = [
    ...proposals.map((item) => ({ kind: "ai" as const, item })),
    ...(improve?.checks ?? []).map((item) => ({
      kind: "check" as const,
      item,
    })),
    ...(improve?.gaps ?? []).map((item) => ({
      kind: "gap" as const,
      item,
    })),
  ];

  const lead =
    proposalsTotal > 0
      ? `${proposalsTotal} ${
          proposalsTotal === 1
            ? "propozycja AI"
            : proposalsTotal < 5
              ? "propozycje AI"
              : "propozycji AI"
        } i luki w profilu.`
      : "Luki w kompletności profilu i rzeczy poza panelem.";

  return (
    <section className="pulpit-card pulpit-improve">
      <header className="pulpit-card-head">
        <div className="pulpit-visibility-title-row">
          <span className="pulpit-icon-circle" aria-hidden>
            <CircleAlert />
          </span>
          <div>
            <h2 className="pulpit-card-title">Co do poprawy</h2>
            <p className="pulpit-card-lead">{lead}</p>
          </div>
        </div>
        <Link href="/wizytowka/informacje" className="pulpit-card-cta">
          Wizytówka
          <ArrowUpRight aria-hidden />
        </Link>
      </header>

      {entries.length === 0 ? (
        <p className="pulpit-empty">
          Nic do poprawy - profil wygląda kompletnie.
        </p>
      ) : (
        <ul className="pulpit-action-list">
          {entries.map((entry) => {
            if (entry.kind === "ai") {
              return (
                <li key={`ai-${entry.item.id}`}>
                  <Link href={entry.item.href} className="pulpit-action-row">
                    <span className="pulpit-action-badge">
                      <Sparkles aria-hidden />
                      AI
                    </span>
                    <span className="pulpit-action-title">
                      {entry.item.label}
                    </span>
                    <span className="pulpit-action-meta">
                      {entry.item.hint}
                    </span>
                  </Link>
                </li>
              );
            }
            if (entry.kind === "check") {
              return (
                <li key={`check-${entry.item.id}`}>
                  <Link href={entry.item.href} className="pulpit-action-row">
                    <span className="pulpit-action-title">
                      {entry.item.label}
                    </span>
                    <span className="pulpit-action-meta">
                      Uzupełnij w panelu
                    </span>
                  </Link>
                </li>
              );
            }
            const gap = entry.item;
            const inner = (
              <>
                <span className="pulpit-action-title">{gap.label}</span>
                <span className="pulpit-action-meta">{gap.why}</span>
              </>
            );
            return (
              <li key={`gap-${gap.id}`}>
                {gap.href ? (
                  <Link href={gap.href} className="pulpit-action-row">
                    {inner}
                  </Link>
                ) : (
                  <div className="pulpit-action-row is-static">{inner}</div>
                )}
              </li>
            );
          })}
          {proposalsTotal > proposals.length ? (
            <li>
              <Link
                href="/wizytowka/informacje"
                className="pulpit-action-row is-more"
              >
                <span className="pulpit-action-title">
                  +{proposalsTotal - proposals.length} więcej propozycji AI
                </span>
              </Link>
            </li>
          ) : null}
        </ul>
      )}
    </section>
  );
}
