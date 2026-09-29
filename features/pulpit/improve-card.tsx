import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowUpRight,
  ChevronRight,
  CircleAlert,
  CircleDashed,
  Sparkles,
} from "lucide-react";
import type {
  PulpitPayload,
  PulpitProposalItem,
} from "@/features/pulpit/load-pulpit";
import type { CompletenessCheck } from "@/features/wizytowka/completeness";
import {
  COMPLETENESS_CHECK_ICONS,
  PROPOSAL_FIELD_ICONS,
} from "@/features/wizytowka/proposal-icons";

type Tone = "ai" | "check";

function ActionRow({
  tone,
  icon,
  title,
  meta,
  href,
}: {
  tone: Tone;
  icon: ReactNode;
  title: string;
  meta: string;
  href?: string;
}) {
  const inner = (
    <>
      <span className={`pulpit-action-icon is-${tone}`} aria-hidden>
        {icon}
      </span>
      <span className="pulpit-action-copy">
        <span className="pulpit-action-title">{title}</span>
        <span className="pulpit-action-meta">{meta}</span>
      </span>
      {href ? <ChevronRight aria-hidden className="pulpit-action-go" /> : null}
    </>
  );
  return (
    <li>
      {href ? (
        <Link href={href} className="pulpit-action-row">
          {inner}
        </Link>
      ) : (
        <div className="pulpit-action-row is-static">{inner}</div>
      )}
    </li>
  );
}

function Group({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: ReactNode;
}) {
  return (
    <div className="pulpit-action-group">
      <p className="pulpit-action-group-title">
        {title}
        <span className="mono">{count}</span>
      </p>
      <ul className="pulpit-action-list">{children}</ul>
    </div>
  );
}

export function ImproveCard({
  improve,
  proposals,
  proposalsTotal,
}: {
  improve: PulpitPayload["improve"];
  proposals: PulpitProposalItem[];
  proposalsTotal: number;
}) {
  const checks: CompletenessCheck[] = improve?.checks ?? [];
  const isEmpty = proposals.length === 0 && checks.length === 0;

  const lead =
    proposalsTotal > 0
      ? `${proposalsTotal} ${
          proposalsTotal === 1
            ? "propozycja AI"
            : proposalsTotal < 5
              ? "propozycje AI"
              : "propozycji AI"
        } i luki w profilu.`
      : "Luki w kompletności profilu.";

  return (
    <section className="pulpit-card pulpit-improve">
      <header className="pulpit-card-head">
        <div className="pulpit-title-row">
          <span className="pulpit-icon-circle is-warn" aria-hidden>
            <CircleAlert />
          </span>
          <div>
            <h2 className="pulpit-card-title">Co do poprawy</h2>
            <p className="pulpit-card-lead">{lead}</p>
          </div>
        </div>
      </header>

      {isEmpty ? (
        <p className="pulpit-empty">
          Nic do poprawy - profil wygląda kompletnie.
        </p>
      ) : (
        <div className="pulpit-action-groups">
          {proposals.length > 0 ? (
            <Group title="Propozycje AI" count={proposalsTotal}>
              {proposals.map((item) => {
                const Icon = PROPOSAL_FIELD_ICONS[item.field] ?? Sparkles;
                return (
                  <ActionRow
                    key={`ai-${item.id}`}
                    tone="ai"
                    icon={<Icon />}
                    title={item.label}
                    meta={item.hint}
                    href={item.href}
                  />
                );
              })}
              {proposalsTotal > proposals.length ? (
                <li>
                  <Link
                    href="/wizytowka/informacje"
                    className="pulpit-action-more"
                  >
                    +{proposalsTotal - proposals.length} więcej propozycji AI
                    <ArrowUpRight aria-hidden />
                  </Link>
                </li>
              ) : null}
            </Group>
          ) : null}

          {checks.length > 0 ? (
            <Group title="Do uzupełnienia" count={checks.length}>
              {checks.map((item) => {
                const Icon = COMPLETENESS_CHECK_ICONS[item.id] ?? CircleDashed;
                return (
                  <ActionRow
                    key={`check-${item.id}`}
                    tone="check"
                    icon={<Icon />}
                    title={item.label}
                    meta="Uzupełnij w panelu"
                    href={item.href}
                  />
                );
              })}
            </Group>
          ) : null}
        </div>
      )}

      <Link href="/wizytowka/informacje" className="pulpit-card-foot">
        Przejdź do wizytówki
        <ArrowUpRight aria-hidden />
      </Link>
    </section>
  );
}
