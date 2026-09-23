import type { GbpSuggestion } from "@/lib/db/schema";
import type { GbpAttributeMetadata } from "@/lib/integrations/gbp/client";
import { attributeId, isFactAttr } from "@/features/wizytowka/attributes";
import type { GbpLocation } from "@/features/wizytowka/types";
import { formatAddress } from "@/features/wizytowka/types";

export type CompletenessCheck = {
  id: string;
  label: string;
  filled: boolean;
  href: string;
};

export type CompletenessSummary = {
  checks: CompletenessCheck[];
  filledCount: number;
  filledTotal: number;
  pendingSuggestions: number;
  factsToConfirm: number;
  outsidePanelGaps: Array<{
    id: string;
    label: string;
    why: string;
    href?: string;
  }>;
  lastAnalyzedAt: Date | null;
};

export function computeCompleteness(input: {
  location: GbpLocation;
  attributes: Array<Record<string, unknown>>;
  attributeMetadata: GbpAttributeMetadata[];
  pendingSuggestions: GbpSuggestion[];
  lastAnalyzedAt: Date | null;
}): CompletenessSummary {
  const { location } = input;

  const checks: CompletenessCheck[] = [
    {
      id: "title",
      label: "Nazwa",
      filled: Boolean(location.title?.trim()),
      href: "/wizytowka/informacje#wiz-field-title",
    },
    {
      id: "primary_category",
      label: "Kategoria",
      filled: Boolean(location.categories?.primaryCategory?.name),
      href: "/wizytowka/informacje#wiz-field-primary_category",
    },
    {
      id: "description",
      label: "Opis",
      filled: Boolean(location.profile?.description?.trim()),
      href: "/wizytowka/informacje#wiz-field-description",
    },
    {
      id: "phone",
      label: "Telefon",
      filled: Boolean(location.phoneNumbers?.primaryPhone?.trim()),
      href: "/wizytowka/informacje#wiz-field-phone",
    },
    {
      id: "website",
      label: "Strona",
      filled: Boolean(location.websiteUri?.trim()),
      href: "/wizytowka/informacje#wiz-field-website",
    },
    {
      id: "address",
      label: "Adres",
      filled: Boolean(formatAddress(location.storefrontAddress)),
      href: "/wizytowka/informacje#wiz-field-address",
    },
    {
      id: "hours",
      label: "Godziny",
      filled: Boolean(location.regularHours?.periods?.length),
      href: "/wizytowka/informacje#wiz-field-hours",
    },
    {
      id: "services",
      label: "Usługi",
      filled: Boolean((location.serviceItems ?? []).length > 0),
      href: "/wizytowka/uslugi#wiz-field-services",
    },
  ];

  const filledAttributes = new Set(
    input.attributes
      .map((a) => (typeof a.name === "string" ? attributeId(a.name) : null))
      .filter((n): n is string => Boolean(n)),
  );

  const factsToConfirm = input.attributeMetadata.filter(
    (meta) =>
      isFactAttr(meta) && !filledAttributes.has(attributeId(meta.parent)),
  ).length;

  const outsidePanelGaps: CompletenessSummary["outsidePanelGaps"] = [];

  if (!location.websiteUri?.trim()) {
    outsidePanelGaps.push({
      id: "website",
      label: "Brak strony WWW",
      why: "Link do witryny zwiększa zaufanie i kliknięcia z profilu Google.",
      href: "/wizytowka/informacje#wiz-field-website",
    });
  }

  if (!location.regularHours?.periods?.length) {
    outsidePanelGaps.push({
      id: "hours",
      label: "Puste godziny otwarcia",
      why: "Bez godzin Google gorzej pokazuje firmę w wynikach „otwarte teraz”.",
      href: "/wizytowka/informacje#wiz-field-hours",
    });
  }

  if (location.metadata?.hasPendingEdits) {
    outsidePanelGaps.push({
      id: "pending_edits",
      label: "Oczekujące zmiany w Google",
      why: "Google wciąż przetwarza edycje - sprawdź status w Profilu Firmy.",
    });
  }

  return {
    checks,
    filledCount: checks.filter((check) => check.filled).length,
    filledTotal: checks.length,
    pendingSuggestions: input.pendingSuggestions.length,
    factsToConfirm,
    outsidePanelGaps,
    lastAnalyzedAt: input.lastAnalyzedAt,
  };
}
