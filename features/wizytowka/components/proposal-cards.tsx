"use client";

import {
  CalendarDays,
  ClipboardList,
  FileText,
  ImageIcon,
  ListChecks,
  Tags,
  Type,
  WandSparkles,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "gooey-toast";
import { acceptAllGbpSuggestions } from "@/features/wizytowka/actions";
import { GBP_PHOTO_MIN } from "@/features/wizytowka/completeness";
import {
  parseJsonArray,
} from "@/features/wizytowka/components/suggestion-display";
import {
  isNudgeProposalCard,
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
const ATTRIBUTES_HREF = "/wizytowka/atrybuty";

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
  if (/^https?:\/\//i.test(href)) {
    window.open(href, "_blank", "noopener,noreferrer");
    return;
  }
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

function cardHref(item: ProposalCardItem, mapsUri?: string | null): string {
  if (item.kind === "categories") {
    return "/wizytowka/informacje#wiz-field-primary_category";
  }
  if (item.kind === "special_hours") {
    return SPECIAL_HOURS_HREF;
  }
  if (item.kind === "attributes") {
    return ATTRIBUTES_HREF;
  }
  if (item.kind === "photos") {
    return mapsUri?.trim() || "/wizytowka";
  }
  return PROPOSAL_META[item.suggestion.field as keyof typeof PROPOSAL_META].href;
}

function cardTitle(item: ProposalCardItem): string {
  if (item.kind === "categories") return "Kategorie";
  if (item.kind === "special_hours") {
    return "Brak nadchodzących dni specjalnych";
  }
  if (item.kind === "attributes") {
    return "Atrybuty do potwierdzenia";
  }
  if (item.kind === "photos") {
    return "Za mało zdjęć na wizytówce";
  }
  return PROPOSAL_META[item.suggestion.field as keyof typeof PROPOSAL_META]
    .label;
}

function cardBlurb(item: ProposalCardItem): string {
  if (item.kind === "special_hours") {
    return `Najbliższe: ${item.hint}`;
  }
  if (item.kind === "attributes") {
    return `${item.count} do potwierdzenia`;
  }
  if (item.kind === "photos") {
    return `${item.count} z ${GBP_PHOTO_MIN} zdjęć`;
  }
  if (item.kind === "categories") {
    const bits: string[] = [];
    if (item.primary) bits.push("kategoria główna");
    if (item.additional) {
      const oldNames =
        (parseJsonArray(item.additional.currentValue ?? "[]") as
          | string[]
          | null) ?? [];
      const newNames =
        (parseJsonArray(item.additional.suggestedValue) as string[] | null) ??
        [];
      const oldSet = new Set(oldNames);
      const newSet = new Set(newNames);
      const added = newNames.filter((n) => !oldSet.has(n)).length;
      const removed = oldNames.filter((n) => !newSet.has(n)).length;
      if (added) bits.push(`+${added}`);
      if (removed) bits.push(`-${removed}`);
      if (!added && !removed && !item.primary) bits.push("kategorie dodatkowe");
    }
    return bits.join(", ") || "Zmiana kategorii";
  }
  const text =
    item.suggestion.rationale?.trim() ||
    item.suggestion.suggestedValue.trim() ||
    "Propozycja AI";
  return text;
}

function cardTabLabel(item: ProposalCardItem): string {
  if (item.kind === "categories" || item.kind === "special_hours") {
    return "Informacje";
  }
  if (item.kind === "attributes") return "Atrybuty";
  if (item.kind === "photos") return "Google";
  return PROPOSAL_META[item.suggestion.field as keyof typeof PROPOSAL_META]
    .tabLabel;
}

function cardActionLabel(item: ProposalCardItem): string {
  if (item.kind === "special_hours") return "Uzupełnij godziny →";
  if (item.kind === "attributes") return "Potwierdź atrybuty →";
  if (item.kind === "photos") return "Otwórz w Google →";
  return "Porównaj zmiany →";
}

function cardIcon(item: ProposalCardItem) {
  if (item.kind === "special_hours") return CalendarDays;
  if (item.kind === "attributes") return ListChecks;
  if (item.kind === "photos") return ImageIcon;
  if (item.kind === "categories") return Tags;
  if (isProposalField(item.suggestion.field)) {
    return (
      FIELD_ICONS[item.suggestion.field as keyof typeof FIELD_ICONS] ?? Tags
    );
  }
  return Tags;
}

function cardKey(item: ProposalCardItem): string {
  if (item.kind === "categories") {
    return `cat-${item.primary?.id ?? ""}-${item.additional?.id ?? ""}`;
  }
  if (item.kind === "special_hours") return "special-hours";
  if (item.kind === "attributes") return "attributes";
  if (item.kind === "photos") return "photos";
  return item.suggestion.id;
}

export function ProposalCards({
  suggestions,
  specialHoursHint = null,
  factsToConfirm = 0,
  photoCount = GBP_PHOTO_MIN,
  mapsUri = null,
}: {
  suggestions: GbpSuggestion[];
  specialHoursHint?: string | null;
  factsToConfirm?: number;
  photoCount?: number;
  mapsUri?: string | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const items = useMemo(
    () =>
      proposalCardItems(suggestions, {
        specialHoursHint,
        factsToConfirm,
        photoCount,
      }),
    [suggestions, specialHoursHint, factsToConfirm, photoCount],
  );
  const aiCount = useMemo(
    () => items.filter((item) => !isNudgeProposalCard(item)).length,
    [items],
  );
  const [sessionTotal] = useState(() => items.length);
  const [resolved, setResolved] = useState(0);

  useEffect(() => {
    scrollToHash();
  }, [pathname]);

  if (items.length === 0 && resolved === 0) return null;

  const remaining = items.length;
  const cols = Math.min(Math.max(remaining, 1), 5);

  function reviewNext() {
    const first = items[0];
    if (!first) return;
    goToHref(pathname, router, cardHref(first, mapsUri));
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
                className="ui-btn ui-btn-primary"
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
            const Icon = cardIcon(item);
            const warn = isNudgeProposalCard(item);

            return (
              <li
                key={cardKey(item)}
                className={`wiz-proposal-card${warn ? " is-warn" : ""}`}
              >
                <div className="wiz-proposal-card-top">
                  <span className="wiz-proposal-icon" aria-hidden>
                    <Icon />
                  </span>
                </div>
                <p className="wiz-proposal-card-title">{cardTitle(item)}</p>
                <p className="wiz-proposal-card-blurb">{cardBlurb(item)}</p>
                <div className="wiz-proposal-card-foot">
                  <span className="wiz-proposal-tab">
                    Zakładka: {cardTabLabel(item)}
                  </span>
                  <button
                    type="button"
                    className="wiz-proposal-compare"
                    onClick={() =>
                      goToHref(pathname, router, cardHref(item, mapsUri))
                    }
                  >
                    {cardActionLabel(item)}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
