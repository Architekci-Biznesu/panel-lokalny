import Link from "next/link";
import { ArrowUpRight, CircleAlert } from "lucide-react";
import type {
  PulpitImproveGap,
  PulpitPayload,
} from "@/features/pulpit/load-pulpit";
import type { CompletenessCheck } from "@/features/wizytowka/completeness";

type ImproveItem =
  | { kind: "check"; item: CompletenessCheck }
  | { kind: "gap"; item: PulpitImproveGap };

export function ImproveCard({
  improve,
}: {
  improve: PulpitPayload["improve"];
}) {
  const items: ImproveItem[] = [
    ...(improve?.checks ?? []).map((item) => ({
      kind: "check" as const,
      item,
    })),
    ...(improve?.gaps ?? []).map((item) => ({
      kind: "gap" as const,
      item,
    })),
  ];

  return (
    <section className="pulpit-card pulpit-improve">
      <header className="pulpit-card-head">
        <div className="pulpit-visibility-title-row">
          <span className="pulpit-icon-circle" aria-hidden>
            <CircleAlert />
          </span>
          <div>
            <h2 className="pulpit-card-title">Co do poprawy</h2>
            <p className="pulpit-card-lead">
              Luki w kompletności profilu i rzeczy poza panelem.
            </p>
          </div>
        </div>
        <Link href="/wizytowka/informacje" className="pulpit-card-cta">
          Wizytówka
          <ArrowUpRight aria-hidden />
        </Link>
      </header>

      {items.length === 0 ? (
        <p className="pulpit-empty">Profil wygląda kompletnie - brawo.</p>
      ) : (
        <ul className="pulpit-action-list">
          {items.map((entry) => {
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
        </ul>
      )}
    </section>
  );
}
