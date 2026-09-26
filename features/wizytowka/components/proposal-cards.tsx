"use client";

import {
  ArrowRight,
  CalendarDays,
  ClipboardList,
  Clock3,
  FileText,
  ImageIcon,
  ListChecks,
  Tags,
  Type,
  WandSparkles,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useTransition } from "react";
import { toast } from "gooey-toast";
import { acceptAllGbpSuggestions } from "@/features/wizytowka/actions";
import { GBP_PHOTO_MIN } from "@/features/wizytowka/completeness";
import { formatWeeklyHoursLabel } from "@/features/wizytowka/hours-compare";
import { aiHintForSuggestion } from "@/features/wizytowka/components/suggestion-display";
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
const REGULAR_HOURS_HREF = "/wizytowka/informacje#wiz-field-hours";
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
  if (item.kind === "regular_hours") {
    return REGULAR_HOURS_HREF;
  }
  if (item.kind === "attributes") {
    return ATTRIBUTES_HREF;
  }
  if (item.kind === "photos") {
    return mapsUri?.trim() || "/wizytowka";
  }
  return PROPOSAL_META[item.suggestion.field as keyof typeof PROPOSAL_META]
    .href;
}

function cardTitle(item: ProposalCardItem): string {
  if (item.kind === "categories") return "Kategorie";
  if (item.kind === "special_hours") {
    return "Brak dni specjalnych";
  }
  if (item.kind === "regular_hours") {
    return "Krótsze godziny niż konkurencja";
  }
  if (item.kind === "attributes") {
    return "Atrybuty";
  }
  if (item.kind === "photos") {
    const target = item.competitorMedian ?? item.competitorMax;
    if (target != null && item.count < target) {
      return "Mniej zdjęć niż konkurencja";
    }
    return "Za mało zdjęć na wizytówce";
  }
  return PROPOSAL_META[item.suggestion.field as keyof typeof PROPOSAL_META]
    .label;
}

function cardBlurb(item: ProposalCardItem): string {
  if (item.kind === "special_hours") {
    return `Najbliższe święta: ${item.hint}. Ustaw godziny, żeby klienci nie trafili na zamknięte drzwi.`;
  }
  if (item.kind === "regular_hours") {
    const target = item.competitorMedian ?? item.competitorMax;
    const ours = formatWeeklyHoursLabel(item.ourWeeklyMinutes);
    if (target != null) {
      const approx =
        item.competitorMedian != null
          ? `zwykle ok. ${formatWeeklyHoursLabel(item.competitorMedian)}`
          : `nawet ${formatWeeklyHoursLabel(item.competitorMax!)}`;
      return `Top konkurencja jest otwarta ${approx} tygodniowo, Ty ${ours}. Rozważ wydłużenie godzin otwarcia.`;
    }
    return `Masz ${ours} otwarcia tygodniowo - warto sprawdzić, czy nie gubisz klientów poza tymi godzinami.`;
  }
  if (item.kind === "attributes") {
    return `${item.count} faktów o firmie czeka na potwierdzenie. Zaznacz, co jest prawdą - AI tego nie zgadnie.`;
  }
  if (item.kind === "photos") {
    const target = item.competitorMedian ?? item.competitorMax;
    if (target != null && item.count < target) {
      const approx =
        item.competitorMedian != null
          ? `zwykle ok. ${item.competitorMedian}`
          : `nawet ${item.competitorMax}`;
      return `Top konkurencja ma ${approx} zdjęć, Ty masz ${item.count}. Dodaj je w Profilu Firmy Google - w panelu nie da się jeszcze wgrywać mediów.`;
    }
    return `Masz ${item.count} z ${GBP_PHOTO_MIN} zdjęć właściciela. Dodaj je w Profilu Firmy Google - w panelu nie da się jeszcze wgrywać mediów.`;
  }
  if (item.kind === "categories") {
    const parts = [item.primary, item.additional]
      .map((s) => s?.rationale?.trim() || (s ? aiHintForSuggestion(s) : ""))
      .filter(Boolean);
    return parts[0] || "AI proponuje zmianę kategorii";
  }
  return (
    item.suggestion.rationale?.trim() || aiHintForSuggestion(item.suggestion)
  );
}

function cardTabLabel(item: ProposalCardItem): string {
  if (
    item.kind === "categories" ||
    item.kind === "special_hours" ||
    item.kind === "regular_hours"
  ) {
    return "Informacje";
  }
  if (item.kind === "attributes") return "Atrybuty";
  if (item.kind === "photos") return "Google";
  return PROPOSAL_META[item.suggestion.field as keyof typeof PROPOSAL_META]
    .tabLabel;
}

function cardActionLabel(item: ProposalCardItem): string {
  if (item.kind === "special_hours") return "Uzupełnij godziny";
  if (item.kind === "regular_hours") return "Sprawdź godziny";
  if (item.kind === "attributes") return "Potwierdź atrybuty";
  if (item.kind === "photos") return "Otwórz w Google";
  return "Porównaj zmiany";
}

function cardIcon(item: ProposalCardItem) {
  if (item.kind === "special_hours") return CalendarDays;
  if (item.kind === "regular_hours") return Clock3;
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
  if (item.kind === "regular_hours") return "regular-hours";
  if (item.kind === "attributes") return "attributes";
  if (item.kind === "photos") return "photos";
  return item.suggestion.id;
}

export function ProposalCards({
  suggestions,
  specialHoursHint = null,
  factsToConfirm = 0,
  photoCount = GBP_PHOTO_MIN,
  competitorPhotoMedian = null,
  competitorPhotoMax = null,
  ourWeeklyMinutes = null,
  competitorHoursMedian = null,
  competitorHoursMax = null,
  mapsUri = null,
}: {
  suggestions: GbpSuggestion[];
  specialHoursHint?: string | null;
  factsToConfirm?: number;
  photoCount?: number;
  competitorPhotoMedian?: number | null;
  competitorPhotoMax?: number | null;
  ourWeeklyMinutes?: number | null;
  competitorHoursMedian?: number | null;
  competitorHoursMax?: number | null;
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
        competitorPhotoMedian,
        competitorPhotoMax,
        ourWeeklyMinutes,
        competitorHoursMedian,
        competitorHoursMax,
      }),
    [
      suggestions,
      specialHoursHint,
      factsToConfirm,
      photoCount,
      competitorPhotoMedian,
      competitorPhotoMax,
      ourWeeklyMinutes,
      competitorHoursMedian,
      competitorHoursMax,
    ],
  );
  const aiCount = useMemo(
    () => items.filter((item) => !isNudgeProposalCard(item)).length,
    [items],
  );

  useEffect(() => {
    scrollToHash();
  }, [pathname]);

  const remaining = items.length;
  const showEmpty = remaining === 0;

  function reviewNext() {
    const first = items[0];
    if (!first) return;
    goToHref(pathname, router, cardHref(first, mapsUri));
  }

  return (
    <div className="wiz-proposals">
      <div className="wiz-proposals-head">
        <div className="wiz-proposals-heading">
          <p className="wiz-proposals-title">Do Twojej decyzji</p>
          {remaining > 0 ? (
            <span className="wiz-proposals-badge mono">{remaining}</span>
          ) : null}
        </div>
        {remaining > 0 ? (
          <div className="wiz-proposals-actions">
            <button
              type="button"
              className="ui-btn ui-btn-white ui-btn-sm"
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

      {showEmpty ? (
        <p className="wiz-proposals-empty">
          Brak propozycji - wizytówka jest aktualna
        </p>
      ) : (
        <ul className="wiz-proposals-grid">
          {items.map((item) => {
            const Icon = cardIcon(item);
            const warn = isNudgeProposalCard(item);

            return (
              <li
                key={cardKey(item)}
                className={`wiz-proposal-card${warn ? " is-warn" : ""}`}
              >
                <div className="wiz-proposal-card-top">
                  <span
                    className={`wiz-proposal-icon-sq${warn ? " is-warn" : ""}`}
                    aria-hidden
                  >
                    <Icon />
                  </span>
                  <div className="wiz-proposal-card-pills">
                    {!warn ? (
                      <span
                        className="wiz-proposal-ai-pill"
                        title="Propozycja AI"
                        aria-label="Propozycja AI"
                      >
                        <WandSparkles aria-hidden />
                      </span>
                    ) : null}
                    <span className="ui-pill ui-pill-neutral wiz-proposal-tab-pill">
                      {cardTabLabel(item)}
                    </span>
                  </div>
                </div>
                <p className="wiz-proposal-card-title">{cardTitle(item)}</p>
                <p className="wiz-proposal-card-blurb">{cardBlurb(item)}</p>
                <button
                  type="button"
                  className={`wiz-proposal-cta${warn ? " is-warn" : ""}`}
                  onClick={() =>
                    goToHref(pathname, router, cardHref(item, mapsUri))
                  }
                >
                  <span>{cardActionLabel(item)}</span>
                  <span className="wiz-proposal-cta-arrow" aria-hidden>
                    <ArrowRight />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
