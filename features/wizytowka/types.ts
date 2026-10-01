export type GbpPhoneNumbers = {
  primaryPhone?: string;
  additionalPhones?: string[];
};

export type GbpPostalAddress = {
  regionCode?: string;
  languageCode?: string;
  postalCode?: string;
  administrativeArea?: string;
  locality?: string;
  addressLines?: string[];
};

export type GbpTimeOfDay = {
  hours?: number;
  minutes?: number;
};

export type GbpPeriod = {
  openDay?: string;
  openTime?: GbpTimeOfDay;
  closeDay?: string;
  closeTime?: GbpTimeOfDay;
};

export type GbpRegularHours = {
  periods?: GbpPeriod[];
};

export type GbpSpecialHourPeriod = {
  startDate?: { year?: number; month?: number; day?: number };
  openTime?: GbpTimeOfDay;
  endDate?: { year?: number; month?: number; day?: number };
  closeTime?: GbpTimeOfDay;
  closed?: boolean;
};

export type GbpSpecialHours = {
  specialHourPeriods?: GbpSpecialHourPeriod[];
};

export type GbpCategoryRef = {
  name?: string;
  displayName?: string;
};

export type GbpCategories = {
  primaryCategory?: GbpCategoryRef;
  additionalCategories?: GbpCategoryRef[];
};

export type GbpStructuredServiceItem = {
  serviceTypeId?: string;
  description?: string;
};

export type GbpFreeFormServiceItem = {
  category?: string;
  label?: { displayName?: string; description?: string };
};

export type GbpServiceItem = {
  structuredServiceItem?: GbpStructuredServiceItem;
  freeFormServiceItem?: GbpFreeFormServiceItem;
};

export type GbpOpenInfo = {
  status?: string;
  canReopen?: boolean;
  openingDate?: { year?: number; month?: number; day?: number };
};

export type GbpServiceArea = {
  businessType?: string;
  places?: { placeInfos?: Array<{ placeName?: string; placeId?: string }> };
  regionCode?: string;
};

export type GbpLocation = {
  name?: string;
  title?: string;
  storefrontAddress?: GbpPostalAddress;
  websiteUri?: string;
  phoneNumbers?: GbpPhoneNumbers;
  regularHours?: GbpRegularHours;
  specialHours?: GbpSpecialHours;
  moreHours?: unknown[];
  categories?: GbpCategories;
  profile?: { description?: string };
  serviceItems?: GbpServiceItem[];
  metadata?: {
    canModifyServiceList?: boolean;
    hasGoogleUpdated?: boolean;
    hasPendingEdits?: boolean;
    mapsUri?: string;
    newReviewUri?: string;
    placeId?: string;
  };
  latlng?: { latitude?: number; longitude?: number };
  openInfo?: GbpOpenInfo;
  serviceArea?: GbpServiceArea;
  labels?: string[];
};

export type ServiceItemDraft = {
  kind: "structured" | "freeForm";
  serviceTypeId?: string;
  category?: string;
  displayName: string;
  description?: string;
};

export function parseLocation(raw: Record<string, unknown>): GbpLocation {
  return raw as GbpLocation;
}

export function serviceItemsToDrafts(
  items: GbpServiceItem[] | undefined,
): ServiceItemDraft[] {
  return (items ?? []).map((item) => {
    if (item.structuredServiceItem?.serviceTypeId) {
      return {
        kind: "structured" as const,
        serviceTypeId: item.structuredServiceItem.serviceTypeId,
        displayName: item.structuredServiceItem.serviceTypeId,
        description: item.structuredServiceItem.description ?? "",
      };
    }
    const free = item.freeFormServiceItem;
    return {
      kind: "freeForm" as const,
      category: free?.category,
      displayName: free?.label?.displayName ?? "",
      description: free?.label?.description ?? "",
    };
  });
}

export function draftsToServiceItems(
  drafts: ServiceItemDraft[],
): GbpServiceItem[] {
  return drafts.map((d) => {
    if (d.kind === "structured" && d.serviceTypeId) {
      return {
        structuredServiceItem: {
          serviceTypeId: d.serviceTypeId,
          description: d.description || undefined,
        },
      };
    }
    return {
      freeFormServiceItem: {
        category: d.category,
        label: {
          displayName: d.displayName,
          description: d.description || undefined,
        },
      },
    };
  });
}

export function formatAddress(addr?: GbpPostalAddress): string {
  if (!addr) return "";
  const parts = [
    ...(addr.addressLines ?? []),
    [addr.postalCode, addr.locality].filter(Boolean).join(" "),
    addr.administrativeArea,
  ].filter(Boolean);
  return parts.join(", ");
}

export function formatOpeningDate(date?: {
  year?: number;
  month?: number;
  day?: number;
}): string {
  if (!date?.year) return "";
  const m = date.month ? String(date.month).padStart(2, "0") : "01";
  const d = date.day ? String(date.day).padStart(2, "0") : "01";
  return `${date.year}-${m}-${d}`;
}

export const WEEKDAYS = [
  { value: "MONDAY", label: "Poniedziałek" },
  { value: "TUESDAY", label: "Wtorek" },
  { value: "WEDNESDAY", label: "Środa" },
  { value: "THURSDAY", label: "Czwartek" },
  { value: "FRIDAY", label: "Piątek" },
  { value: "SATURDAY", label: "Sobota" },
  { value: "SUNDAY", label: "Niedziela" },
] as const;

/**
 * "HH:MM" of a Google time. An empty object is midnight (Google leaves the
 * zero fields out); a missing time gives "".
 */
export function formatTime(t?: GbpTimeOfDay): string {
  if (!t) return "";
  const h = String(t.hours ?? 0).padStart(2, "0");
  const m = String(t.minutes ?? 0).padStart(2, "0");
  return `${h}:${m}`;
}

export function parseTime(value: string): GbpTimeOfDay | undefined {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return undefined;
  return { hours: Number(match[1]), minutes: Number(match[2]) };
}
