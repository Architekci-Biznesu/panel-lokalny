import type { GbpSuggestion } from "@/lib/db/schema";
import type { GbpAttributeMetadata } from "@/lib/integrations/gbp/client";
import { attributeId, isFactAttr } from "@/features/wizytowka/attributes";
import type { GbpLocation } from "@/features/wizytowka/types";
import { formatAddress } from "@/features/wizytowka/types";

/** Minimum owner-uploaded photos for the profile to count as complete. */
export const GBP_PHOTO_MIN = 10;

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
  photoCount: number;
  lastAnalyzedAt: Date | null;
};

export function computeCompleteness(input: {
  location: GbpLocation;
  attributes: Array<Record<string, unknown>>;
  attributeMetadata: GbpAttributeMetadata[];
  pendingSuggestions: GbpSuggestion[];
  lastAnalyzedAt: Date | null;
  /** Owner-uploaded photo count (excludes customer media). */
  photoCount?: number;
}): CompletenessSummary {
  const { location } = input;
  const photoCount = input.photoCount ?? 0;

  const filledAttributes = new Set(
    input.attributes
      .map((a) => (typeof a.name === "string" ? attributeId(a.name) : null))
      .filter((n): n is string => Boolean(n)),
  );

  const factsToConfirm = input.attributeMetadata.filter(
    (meta) =>
      isFactAttr(meta) && !filledAttributes.has(attributeId(meta.parent)),
  ).length;

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
    {
      id: "attributes",
      label: "Atrybuty",
      filled: factsToConfirm === 0,
      href: "/wizytowka/atrybuty",
    },
    {
      id: "photos",
      label: "Zdjęcia",
      filled: photoCount >= GBP_PHOTO_MIN,
      href: "/wizytowka/raporty",
    },
  ];

  return {
    checks,
    filledCount: checks.filter((check) => check.filled).length,
    filledTotal: checks.length,
    pendingSuggestions: input.pendingSuggestions.length,
    factsToConfirm,
    photoCount,
    lastAnalyzedAt: input.lastAnalyzedAt,
  };
}
