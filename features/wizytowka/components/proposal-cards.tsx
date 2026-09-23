"use client";

import {
  ArrowUpRight,
  CalendarDays,
  ClipboardList,
  FileText,
  Tags,
  Type,
  WandSparkles,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "gooey-toast";
import { acceptAllGbpSuggestions } from "@/features/wizytowka/actions";
import { aiHintForSuggestion } from "@/features/wizytowka/components/suggestion-display";
import {
  isProposalField,
  PROPOSAL_META,
  proposalCardItems,
  type ProposalCardItem,
} from "@/features/wizytowka/proposal-meta";
import type { GbpSuggestion } from "@/lib/db/schema";

const FIELD_ICONS = {
  title: Type,
  description: FileText,
  services: ClipboardList,
} as const;

const SPECIAL_HOURS_HREF = "/wizytowka/informacje#wiz-field-special-hours";

function scrollToHash() {
  const id = window.location.hash.replace(/^#/, "");
  if (!id) return;
  document.getElementById(id)?.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
}

function goToHref(
  pathname: string,
  router: ReturnType<typeof useRouter>,
  href: string,
) {
  const hashIndex = href.indexOf("#");
  const path = hashIndex === -1 ? href : href.slice(0, hashIndex);
  const id = hashIndex === -1 ? "" : href.slice(hashIndex + 1);
  if (pathname === path && id) {
    document.getElementById(id)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
    window.history.replaceState(null, "", href);
    return;
  }
  router.push(href);
}

function cardHref(item: ProposalCardItem): string {
  if (item.kind === "categories") {
    return "/wizytowka/informacje#wiz-field-primary_category";
  }
  if (item.kind === "special_hours") {
    return SPECIAL_HOURS_HREF;
  }
  return PROPOSAL_META[item.suggestion.field as keyof typeof PROPOSAL_META].href;
}

function cardTitle(item: ProposalCardItem): string {
  if (item.kind === "categories") return "Kategorie";
  if (item.kind === "special_hours") {
    return "Brak nadchodzących dni specjalnych";
  }
  return PROPOSAL_META[item.suggestion.field as keyof typeof PROPOSAL_META]
    .label;
}

function cardBlurb(item: ProposalCardItem): string {
  if (item.kind === "special_hours") {
    return `Najbliższe święta: ${item.hint}. Ustaw godziny, żeby klienci nie trafili na zamknięte drzwi.`;
  }
  if (item.kind === "categories") {
    const parts = [item.primary, item.additional]
      .map((s) => s?.rationale?.trim() || (s ? aiHintForSuggestion(s) : ""))
      .filter(Boolean);
    return parts[0] || "AI proponuje zmianę kategorii";
  }
  return (
    item.suggestion.rationale?.trim() ||
    aiHintForSuggestion(item.suggestion)
  );
}

function cardTabLabel(item: ProposalCardItem): string {
  if (item.kind === "categories" || item.kind === "special_hours") {
    return "Informacje";
  }
  return PROPOSAL_META[item.suggestion.field as keyof typeof PROPOSAL_META]
    .tabLabel;
}

function cardActionLabel(item: ProposalCardItem): string {
  if (item.kind === "special_hours") return "Uzupełnij godziny →";
  return "Porównaj zmiany →";
}

function cardIcon(item: ProposalCardItem) {
  if (item.kind === "special_hours") return CalendarDays;
  if (item.kind === "categories") return Tags;
  if (isProposalField(item.suggestion.field)) {
    return (
      FIELD_ICONS[item.suggestion.field as keyof typeof FIELD_ICONS] ?? Tags
    );
  }
  return Tags;
}

export function ProposalCards({
  suggestions,
  specialHoursHint = null,
}: {
  suggestions: GbpSuggestion[];
  specialHoursHint?: string | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const items = useMemo(
    () => proposalCardItems(suggestions, specialHoursHint),
    [suggestions, specialHoursHint],
  );
  const aiCount = useMemo(
    () => items.filter((item) => item.kind !== "special_hours").length,
    [items],
  );
  const [sessionTotal] = useState(() => items.length);
  const [resolved, setResolved] = useState(0);

  useEffect(() => {
    scrollToHash();
  }, [pathname]);

  if (items.length === 0 && resolved === 0) return null;

  const remaining = items.length;
  const shownResolved = Math.min(
    sessionTotal,
    Math.max(resolved, sessionTotal - remaining),
  );
  const cols = Math.min(Math.max(remaining, 1), 3);

  function reviewNext() {
    const first = items[0];
    if (!first) return;
    goToHref(pathname, router, cardHref(first));
  }

  return (
    <div className="wiz-proposals">
      <div className="wiz-proposals-head">
        <div className="wiz-proposals-heading">
          <WandSparkles aria-hidden className="wiz-proposals-wand" />
          <p className="wiz-proposals-title">Propozycje AI do Twojej decyzji</p>
          {remaining > 0 ? (
            <span className="wiz-proposals-badge">{remaining}</span>
          ) : null}
        </div>
        {remaining > 0 ? (
          <div className="wiz-proposals-actions">
            <button
              type="button"
              className="ui-btn ui-btn-outline ui-btn-sm"
              onClick={reviewNext}
            >
              <span>Przejrzyj po kolei</span>
            </button>
            {aiCount > 0 ? (
              <button
                type="button"
                className="ui-btn ui-btn-primary ui-btn-sm"
                disabled={pending}
                onClick={() => {
                  startTransition(async () => {
                    const result = await acceptAllGbpSuggestions();
                    if (!result.ok) {
                      toast.error({
                        title: "Nie udało się zaakceptować",
                        description: result.error,
                      });
                      return;
                    }
                    setResolved(sessionTotal);
                    toast.success({
                      title: "Zaakceptowano propozycje",
                      description:
                        result.accepted > 0
                          ? `${result.accepted} zapisanych w Google`
                          : undefined,
                    });
                    router.refresh();
                  });
                }}
              >
                <span>Akceptuj wszystkie</span>
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {remaining > 0 ? (
        <ul
          className="wiz-proposals-grid"
          style={{ ["--proposal-cols" as string]: String(cols) }}
        >
          {items.map((item) => {
            const key =
              item.kind === "categories"
                ? `cat-${item.primary?.id ?? ""}-${item.additional?.id ?? ""}`
                : item.kind === "special_hours"
                  ? "special-hours"
                  : item.suggestion.id;
            const Icon = cardIcon(item);

            return (
              <li
                key={key}
                className={`wiz-proposal-card${item.kind === "special_hours" ? " is-warn" : ""}`}
              >
                <div className="wiz-proposal-card-top">
                  <span className="wiz-proposal-icon" aria-hidden>
                    <Icon />
                  </span>
                  <span className="wiz-proposal-tab">
                    Zakładka: {cardTabLabel(item)}
                  </span>
                </div>
                <p className="wiz-proposal-card-title">{cardTitle(item)}</p>
                <p className="wiz-proposal-card-blurb">{cardBlurb(item)}</p>
                <button
                  type="button"
                  className="wiz-proposal-compare"
                  onClick={() => goToHref(pathname, router, cardHref(item))}
                >
                  {cardActionLabel(item)}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}

      {sessionTotal > 0 ? (
        <div className="wiz-proposals-foot">
          <div className="wiz-proposals-progress" aria-hidden>
            <span
              style={{
                width: `${sessionTotal ? (shownResolved / sessionTotal) * 100 : 0}%`,
              }}
            />
          </div>
          <div className="wiz-proposals-foot-row">
            <p className="wiz-proposals-progress-label">
              {shownResolved} z {sessionTotal} rozpatrzonych
            </p>
            <Link href="/ustawienia/kontekst" className="ui-btn ui-btn-outline ui-btn-sm">
              <span>Zaktualizuj kontekst firmy</span>
              <ArrowUpRight aria-hidden />
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
