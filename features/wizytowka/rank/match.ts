import type { ScrapingDogPlaceResult } from "@/lib/integrations/scrapingdog";

export type RankMatchMethod = "place_id" | "name_fallback" | "none";

export type RankMatch = {
  position: number | null;
  matchMethod: RankMatchMethod;
};

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function nameAddressMatch(
  result: ScrapingDogPlaceResult,
  businessName: string,
  businessAddress: string | null,
): boolean {
  const resultName = normalizeText(result.title);
  const targetName = normalizeText(businessName);
  if (!resultName || !targetName) return false;
  if (
    resultName !== targetName &&
    !resultName.includes(targetName) &&
    !targetName.includes(resultName)
  ) {
    return false;
  }
  if (!businessAddress) return true;
  const resultAddress = normalizeText(result.address ?? "");
  const targetAddress = normalizeText(businessAddress);
  if (!resultAddress || !targetAddress) return true;
  const targetTokens = targetAddress.split(" ").filter((t) => t.length > 2);
  if (targetTokens.length === 0) return true;
  const hits = targetTokens.filter((token) => resultAddress.includes(token));
  return hits.length >= Math.min(2, targetTokens.length);
}

/**
 * Prefer Google Place ID (ChIJ…). Numeric CIDs from google_local are not usable
 * for matching against GBP metadata.placeId - treat them as missing place_id.
 */
function usablePlaceId(id: string | null): string | null {
  if (!id) return null;
  if (id.startsWith("ChIJ") || id.startsWith("GhIJ")) return id;
  return null;
}

/**
 * Prefer place_id. Name+address fallback only when the result has no usable place_id.
 */
export function matchBusinessInResults(input: {
  results: ScrapingDogPlaceResult[];
  placeId: string;
  businessName: string;
  businessAddress: string | null;
}): RankMatch {
  const { results, placeId, businessName, businessAddress } = input;
  const targetPlaceId = placeId.trim();

  for (const result of results) {
    const resultPlaceId = usablePlaceId(result.placeId);
    if (resultPlaceId && targetPlaceId && resultPlaceId === targetPlaceId) {
      return { position: result.position, matchMethod: "place_id" };
    }
  }

  for (const result of results) {
    if (usablePlaceId(result.placeId)) continue;
    if (nameAddressMatch(result, businessName, businessAddress)) {
      return { position: result.position, matchMethod: "name_fallback" };
    }
  }

  return { position: null, matchMethod: "none" };
}
