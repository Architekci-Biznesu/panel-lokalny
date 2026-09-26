import type { GbpPostalAddress } from "@/features/wizytowka/types";

/**
 * City only - ScrapingDog google_local `location` must not be a full street address.
 */
export function cityFromStorefrontAddress(
  address: GbpPostalAddress | null | undefined,
): string | null {
  const locality = address?.locality?.trim();
  if (locality) return locality;

  const admin = address?.administrativeArea?.trim();
  if (admin) return admin;

  return null;
}

export function formatStorefrontAddress(
  address: GbpPostalAddress | null | undefined,
): string | null {
  if (!address) return null;
  const parts = [
    ...(address.addressLines ?? []),
    address.postalCode,
    address.locality,
    address.administrativeArea,
  ]
    .map((p) => (typeof p === "string" ? p.trim() : ""))
    .filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : null;
}
