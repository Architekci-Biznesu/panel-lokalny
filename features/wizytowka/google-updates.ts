import type { GbpGoogleUpdated } from "@/lib/integrations/gbp/client";

/**
 * Fields where Google shows something else than the owner's version
 * (getGoogleUpdated: diffMask) or where the owner's edit still waits for
 * Google's review (pendingMask). Pure - used by the layout and editors.
 */

export type GoogleField =
  | "title"
  | "description"
  | "categories"
  | "phone"
  | "website"
  | "address"
  | "serviceArea"
  | "regularHours"
  | "specialHours"
  | "openInfo"
  | "services";

/** Top-level Location field behind each panel field, and its update mask. */
export const GOOGLE_FIELD_PATHS: Record<
  GoogleField,
  { top: string; updateMask: string }
> = {
  title: { top: "title", updateMask: "title" },
  description: { top: "profile", updateMask: "profile.description" },
  categories: { top: "categories", updateMask: "categories" },
  phone: { top: "phoneNumbers", updateMask: "phoneNumbers" },
  website: { top: "websiteUri", updateMask: "websiteUri" },
  address: { top: "storefrontAddress", updateMask: "storefrontAddress" },
  serviceArea: { top: "serviceArea", updateMask: "serviceArea" },
  regularHours: { top: "regularHours", updateMask: "regularHours" },
  specialHours: { top: "specialHours", updateMask: "specialHours" },
  openInfo: { top: "openInfo", updateMask: "openInfo" },
  services: { top: "serviceItems", updateMask: "serviceItems" },
};

export const GOOGLE_FIELD_LABELS: Record<GoogleField, string> = {
  title: "Nazwa firmy",
  description: "Opis",
  categories: "Kategorie",
  phone: "Telefon",
  website: "Witryna",
  address: "Adres",
  serviceArea: "Obszar obsługi",
  regularHours: "Godziny otwarcia",
  specialHours: "Dni specjalne",
  openInfo: "Status",
  services: "Usługi",
};

const FIELD_BY_TOP = new Map(
  (
    Object.entries(GOOGLE_FIELD_PATHS) as Array<[GoogleField, { top: string }]>
  ).map(([field, path]) => [path.top, field]),
);

/** `profile.description` -> description; unknown paths (metadata, ...) -> null. */
function fieldOfPath(path: string): GoogleField | null {
  return FIELD_BY_TOP.get(path.split(".")[0]) ?? null;
}

export type GoogleFieldChange = {
  field: GoogleField;
  /** google = Google changed it; pending = the owner's edit is under review. */
  kind: "google" | "pending";
  /** What customers see now, as short text (null when it has no short form). */
  customerValue: string | null;
};

type Raw = Record<string, unknown>;

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** Short text of a field in a Location (what customers see in Google). */
function summarize(field: GoogleField, location: Raw): string | null {
  switch (field) {
    case "title":
      return text(location.title);
    case "description": {
      const description = text(
        (location.profile as { description?: string } | undefined)?.description,
      );
      return description && description.length > 220
        ? `${description.slice(0, 220).trimEnd()}…`
        : description;
    }
    case "categories": {
      const categories = location.categories as
        | {
            primaryCategory?: { displayName?: string };
            additionalCategories?: Array<{ displayName?: string }>;
          }
        | undefined;
      const names = [
        categories?.primaryCategory?.displayName,
        ...(categories?.additionalCategories?.map((c) => c.displayName) ?? []),
      ].filter((name): name is string => Boolean(name));
      return names.length ? names.join(", ") : null;
    }
    case "phone":
      return text(
        (location.phoneNumbers as { primaryPhone?: string } | undefined)
          ?.primaryPhone,
      );
    case "website":
      return text(location.websiteUri);
    case "address": {
      const address = location.storefrontAddress as
        | { addressLines?: string[]; postalCode?: string; locality?: string }
        | undefined;
      if (!address) return null;
      const city = [address.postalCode, address.locality]
        .filter(Boolean)
        .join(" ");
      return [...(address.addressLines ?? []), city].filter(Boolean).join(", ");
    }
    default:
      return null;
  }
}

/** One change per panel field; a pending review wins over a Google change. */
export function googleFieldChanges(
  updated: GbpGoogleUpdated | null | undefined,
): GoogleFieldChange[] {
  if (!updated) return [];
  const byField = new Map<GoogleField, GoogleFieldChange>();
  const add = (paths: string[], kind: GoogleFieldChange["kind"]) => {
    for (const path of paths) {
      const field = fieldOfPath(path);
      if (!field || byField.get(field)?.kind === "pending") continue;
      byField.set(field, {
        field,
        kind,
        customerValue: summarize(field, updated.location),
      });
    }
  };
  add(updated.diffMask, "google");
  add(updated.pendingMask, "pending");
  return [...byField.values()];
}

/**
 * Body of a PATCH that sets one field to the value from `location` (Google's
 * version or the owner's own) - the whole top-level field, as the panel does.
 */
export function patchForField(
  field: GoogleField,
  location: Raw,
): { body: Raw; updateMask: string[] } {
  const { top, updateMask } = GOOGLE_FIELD_PATHS[field];
  if (field === "description") {
    const description =
      (location.profile as { description?: string } | undefined)?.description ??
      "";
    return { body: { profile: { description } }, updateMask: [updateMask] };
  }
  return { body: { [top]: location[top] }, updateMask: [updateMask] };
}
