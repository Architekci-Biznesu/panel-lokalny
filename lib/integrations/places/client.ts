export type PlaceRegionSuggestion = {
  placeId: string;
  placeName: string;
};

/**
 * Autocomplete region-type places for GBP serviceArea (Places API New).
 * Requires GOOGLE_PLACES_API_KEY with Places API (New) enabled.
 */
export async function autocompleteRegions(
  input: string,
): Promise<PlaceRegionSuggestion[]> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "Brak GOOGLE_PLACES_API_KEY - dodaj klucz Places API (New) w zmiennych środowiskowych",
    );
  }

  const query = input.trim();
  if (query.length < 2) return [];

  const response = await fetch(
    "https://places.googleapis.com/v1/places:autocomplete",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
      },
      body: JSON.stringify({
        input: query,
        languageCode: "pl",
        regionCode: "PL",
        includedRegionCodes: ["pl"],
        includedPrimaryTypes: [
          "locality",
          "administrative_area_level_1",
          "administrative_area_level_2",
          "postal_town",
          "sublocality",
        ],
      }),
    },
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Places autocomplete failed: ${body}`);
  }

  const data = (await response.json()) as {
    suggestions?: Array<{
      placePrediction?: {
        placeId?: string;
        text?: { text?: string };
        structuredFormat?: {
          mainText?: { text?: string };
          secondaryText?: { text?: string };
        };
      };
    }>;
  };

  const results: PlaceRegionSuggestion[] = [];
  for (const item of data.suggestions ?? []) {
    const pred = item.placePrediction;
    if (!pred?.placeId) continue;
    const main = pred.structuredFormat?.mainText?.text?.trim();
    const secondary = pred.structuredFormat?.secondaryText?.text?.trim();
    const placeName =
      main && secondary
        ? `${main}, ${secondary}`
        : main || pred.text?.text?.trim() || pred.placeId;
    results.push({ placeId: pred.placeId, placeName });
  }
  return results;
}
