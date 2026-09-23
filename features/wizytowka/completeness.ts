import type { GbpSuggestion } from "@/lib/db/schema";
import type { GbpAttributeMetadata } from "@/lib/integrations/gbp/client";
import type { GbpLocation } from "@/features/wizytowka/types";
import { formatAddress } from "@/features/wizytowka/types";

export type CompletenessSummary = {
  filledCount: number;
  filledTotal: number;
  pendingSuggestions: number;
  factsToConfirm: number;
  outsidePanelGaps: Array<{ id: string; label: string; why: string }>;
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

  const checks: boolean[] = [
    Boolean(location.title?.trim()),
    Boolean(location.categories?.primaryCategory?.name),
    Boolean(location.profile?.description?.trim()),
    Boolean(location.phoneNumbers?.primaryPhone?.trim()),
    Boolean(location.websiteUri?.trim()),
    Boolean(formatAddress(location.storefrontAddress)),
    Boolean(location.regularHours?.periods?.length),
    Boolean((location.serviceItems ?? []).length > 0),
  ];

  const filledAttributes = new Set(
    input.attributes
      .map((a) => (typeof a.name === "string" ? a.name : null))
      .filter((n): n is string => Boolean(n)),
  );

  const factsToConfirm = input.attributeMetadata.filter(
    (meta) => !filledAttributes.has(meta.parent),
  ).length;

  const outsidePanelGaps: CompletenessSummary["outsidePanelGaps"] = [];

  if (!location.websiteUri?.trim()) {
    outsidePanelGaps.push({
      id: "website",
      label: "Brak strony WWW",
      why: "Link do witryny zwiększa zaufanie i kliknięcia z profilu Google.",
    });
  }

  if (!location.regularHours?.periods?.length) {
    outsidePanelGaps.push({
      id: "hours",
      label: "Puste godziny otwarcia",
      why: "Bez godzin Google gorzej pokazuje firmę w wynikach „otwarte teraz”.",
    });
  }

  // Photos / verification are not fully exposed in Business Information API;
  // signal when metadata hints at incomplete presence.
  if (location.metadata?.hasPendingEdits) {
    outsidePanelGaps.push({
      id: "pending_edits",
      label: "Oczekujące zmiany w Google",
      why: "Google wciąż przetwarza edycje - sprawdź status w Profilu Firmy.",
    });
  }

  outsidePanelGaps.push({
    id: "photos",
    label: "Zdjęcia wizytówki",
    why: "Zdjęcia z wizytówki pokazujemy w podglądzie - pełna edycja mediów w późniejszej fazie.",
  });

  return {
    filledCount: checks.filter(Boolean).length,
    filledTotal: checks.length,
    pendingSuggestions: input.pendingSuggestions.length,
    factsToConfirm,
    outsidePanelGaps,
    lastAnalyzedAt: input.lastAnalyzedAt,
  };
}
