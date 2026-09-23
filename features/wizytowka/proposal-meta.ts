import type { GbpSuggestion } from "@/lib/db/schema";
import { GBP_PHOTO_MIN } from "@/features/wizytowka/completeness";

export const PROPOSAL_ORDER = [
  "title",
  "primary_category",
  "additional_categories",
  "description",
  "services",
] as const;

export type ProposalField = (typeof PROPOSAL_ORDER)[number];

export const WIZ_TABS = [
  { href: "/wizytowka/informacje", label: "Informacje" },
  { href: "/wizytowka/uslugi", label: "Usługi" },
  { href: "/wizytowka/kontakt", label: "Kontakt" },
  { href: "/wizytowka/atrybuty", label: "Atrybuty" },
  { href: "/wizytowka/nap", label: "NAP" },
  { href: "/wizytowka/raporty", label: "Raporty" },
] as const;

export type WizTabHref = (typeof WIZ_TABS)[number]["href"];

export const PROPOSAL_META: Record<
  ProposalField,
  { label: string; href: string; tabHref: WizTabHref; tabLabel: string }
> = {
  title: {
    label: "Nazwa firmy",
    href: "/wizytowka/informacje#wiz-field-title",
    tabHref: "/wizytowka/informacje",
    tabLabel: "Informacje",
  },
  primary_category: {
    label: "Kategoria główna",
    href: "/wizytowka/informacje#wiz-field-primary_category",
    tabHref: "/wizytowka/informacje",
    tabLabel: "Informacje",
  },
  additional_categories: {
    label: "Kategorie dodatkowe",
    href: "/wizytowka/informacje#wiz-field-additional_categories",
    tabHref: "/wizytowka/informacje",
    tabLabel: "Informacje",
  },
  description: {
    label: "Opis",
    href: "/wizytowka/informacje#wiz-field-description",
    tabHref: "/wizytowka/informacje",
    tabLabel: "Informacje",
  },
  services: {
    label: "Usługi",
    href: "/wizytowka/uslugi#wiz-field-services",
    tabHref: "/wizytowka/uslugi",
    tabLabel: "Usługi",
  },
};

export function isProposalField(field: string): field is ProposalField {
  return (PROPOSAL_ORDER as readonly string[]).includes(field);
}

/** One pending suggestion per field (newest wins if duplicates). */
export function uniquePendingByField(
  suggestions: GbpSuggestion[],
): GbpSuggestion[] {
  const map = new Map<string, GbpSuggestion>();
  for (const item of suggestions) {
    if (!map.has(item.field)) map.set(item.field, item);
  }
  return PROPOSAL_ORDER.map((field) => map.get(field)).filter(
    (item): item is GbpSuggestion => Boolean(item),
  );
}

/** Cards for the proposals strip - category fields merge into one "Kategorie" card. */
export type ProposalCardItem =
  | { kind: "field"; suggestion: GbpSuggestion }
  | {
      kind: "categories";
      primary?: GbpSuggestion;
      additional?: GbpSuggestion;
    }
  | { kind: "special_hours"; hint: string }
  | { kind: "attributes"; count: number }
  | { kind: "photos"; count: number };

export type ProposalCardHints = {
  specialHoursHint?: string | null;
  factsToConfirm?: number;
  photoCount?: number;
};

export function isNudgeProposalCard(
  item: ProposalCardItem,
): item is
  | { kind: "special_hours"; hint: string }
  | { kind: "attributes"; count: number }
  | { kind: "photos"; count: number } {
  return (
    item.kind === "special_hours" ||
    item.kind === "attributes" ||
    item.kind === "photos"
  );
}

export function proposalCardItems(
  suggestions: GbpSuggestion[],
  hints: ProposalCardHints = {},
): ProposalCardItem[] {
  const pending = uniquePendingByField(suggestions);
  const primary = pending.find((s) => s.field === "primary_category");
  const additional = pending.find((s) => s.field === "additional_categories");
  const rest = pending.filter(
    (s) =>
      s.field !== "primary_category" && s.field !== "additional_categories",
  );

  const items: ProposalCardItem[] = [];
  let insertedCategories = false;

  for (const field of PROPOSAL_ORDER) {
    if (field === "primary_category" || field === "additional_categories") {
      if (!insertedCategories && (primary || additional)) {
        items.push({ kind: "categories", primary, additional });
        insertedCategories = true;
      }
      continue;
    }
    const suggestion = rest.find((s) => s.field === field);
    if (suggestion) items.push({ kind: "field", suggestion });
  }

  if (hints.specialHoursHint) {
    items.push({ kind: "special_hours", hint: hints.specialHoursHint });
  }

  if ((hints.factsToConfirm ?? 0) > 0) {
    items.push({ kind: "attributes", count: hints.factsToConfirm ?? 0 });
  }

  const photoCount = hints.photoCount ?? 0;
  if (photoCount < GBP_PHOTO_MIN) {
    items.push({ kind: "photos", count: photoCount });
  }

  return items;
}

export function countSuggestionsByTab(
  suggestions: GbpSuggestion[],
): Partial<Record<WizTabHref, number>> {
  const counts: Partial<Record<WizTabHref, number>> = {};
  for (const item of uniquePendingByField(suggestions)) {
    if (!isProposalField(item.field)) continue;
    const tab = PROPOSAL_META[item.field].tabHref;
    counts[tab] = (counts[tab] ?? 0) + 1;
  }
  return counts;
}
