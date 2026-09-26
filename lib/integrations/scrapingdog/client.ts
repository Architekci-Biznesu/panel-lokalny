export type ScrapingDogPlaceResult = {
  placeId: string | null;
  dataId: string | null;
  title: string;
  address: string | null;
  description: string | null;
  type: string | null;
  types: string[];
  position: number;
  rating: number | null;
  reviews: number | null;
};

export type ScrapingDogPhotosCount = {
  count: number;
  hasMore: boolean;
};

function getApiKey(): string {
  const key = process.env.SCRAPINGDOG_API_KEY?.trim();
  if (!key) {
    throw new Error("Brak SCRAPINGDOG_API_KEY w konfiguracji");
  }
  return key;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function readString(
  obj: Record<string, unknown>,
  ...keys: string[]
): string | null {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function readNumber(
  obj: Record<string, unknown>,
  ...keys: string[]
): number | null {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim()) {
      const n = Number(value.replace(",", ".").replace(/[^\d.-]/g, ""));
      if (Number.isFinite(n)) return n;
    }
  }
  return null;
}

function readTypes(row: Record<string, unknown>): string[] {
  const out: string[] = [];
  const single = readString(row, "type", "category");
  if (single) out.push(single);
  const raw = row.types ?? row.categories;
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (typeof item === "string" && item.trim()) {
        out.push(item.trim());
        continue;
      }
      const rec = asRecord(item);
      if (!rec) continue;
      const label = readString(rec, "name", "type", "title", "displayName");
      if (label) out.push(label);
    }
  }
  return [...new Set(out)];
}

function parsePlaceList(
  items: unknown[],
  positionOffset = 0,
): ScrapingDogPlaceResult[] {
  const results: ScrapingDogPlaceResult[] = [];
  for (let i = 0; i < items.length; i++) {
    const row = asRecord(items[i]);
    if (!row) continue;
    const title = readString(row, "title", "name");
    if (!title) continue;
    const placeId = readString(row, "place_id", "placeId");
    const dataId = readString(row, "data_id", "dataId");
    const address = readString(row, "address", "formatted_address");
    const description = readString(row, "description", "snippet");
    const types = readTypes(row);
    const rating = readNumber(row, "rating");
    const reviews = readNumber(row, "reviews", "reviews_count", "review_count");
    const explicitPosition =
      typeof row.position === "number" && Number.isFinite(row.position)
        ? row.position
        : null;
    results.push({
      placeId,
      dataId,
      title,
      address,
      description,
      type: types[0] ?? null,
      types,
      rating,
      reviews,
      position: explicitPosition ?? positionOffset + i + 1,
    });
  }
  return results;
}

async function getJson(
  url: string,
  params: Record<string, string>,
): Promise<unknown> {
  const endpoint = new URL(url);
  for (const [key, value] of Object.entries(params)) {
    endpoint.searchParams.set(key, value);
  }

  const response = await fetch(endpoint, {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `ScrapingDog ${endpoint.pathname} failed (${response.status}): ${body.slice(0, 300)}`,
    );
  }

  return response.json();
}

async function getJsonWithRetry(
  url: string,
  params: Record<string, string>,
  attempts = 3,
): Promise<unknown> {
  let lastError: Error | null = null;
  for (let i = 0; i < attempts; i++) {
    try {
      return await getJson(url, params);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const isRetryable = lastError.message.includes("(400)");
      if (!isRetryable || i === attempts - 1) throw lastError;
      await new Promise((r) => setTimeout(r, 1200 * (i + 1)));
    }
  }
  throw lastError ?? new Error("ScrapingDog request failed");
}

export async function mapsSearch(input: {
  query: string;
  lat: number;
  lng: number;
  zoom: number;
}): Promise<ScrapingDogPlaceResult[]> {
  const data = await getJsonWithRetry(
    "https://api.scrapingdog.com/google_maps",
    {
      api_key: getApiKey(),
      query: input.query,
      ll: `@${input.lat},${input.lng},${input.zoom}z`,
      country: "pl",
    },
  );

  const root = asRecord(data) ?? {};
  const list =
    (Array.isArray(root.search_results) && root.search_results) ||
    (Array.isArray(root.local_results) && root.local_results) ||
    (Array.isArray(root.results) && root.results) ||
    [];

  return parsePlaceList(list).slice(0, 20);
}

function parseLocalPayload(data: unknown): ScrapingDogPlaceResult[] {
  const root = asRecord(data) ?? {};
  const list =
    (Array.isArray(root.local_results) && root.local_results) ||
    (Array.isArray(root.search_results) && root.search_results) ||
    (Array.isArray(root.results) && root.results) ||
    [];
  return parsePlaceList(list).slice(0, 20);
}

/**
 * ScrapingDog /google_local is intermittently 400. Try several param shapes,
 * then fall back to /google_maps at the business lat/lng (stable for PL).
 */
export async function localSearch(input: {
  query: string;
  city: string;
  lat: number;
  lng: number;
}): Promise<ScrapingDogPlaceResult[]> {
  const phrase = input.query.trim();
  const city = input.city.trim();
  const apiKey = getApiKey();
  const attempts: Array<Record<string, string>> = [
    {
      api_key: apiKey,
      query: phrase,
      location: `${city}, Poland`,
      country: "pl",
      language: "pl",
    },
    {
      api_key: apiKey,
      query: phrase,
      location: city,
      country: "pl",
    },
    {
      api_key: apiKey,
      query: `${phrase} in ${city}`,
      country: "pl",
    },
    {
      api_key: apiKey,
      query: phrase,
      ll: `@${input.lat},${input.lng},14z`,
      country: "pl",
    },
  ];

  let lastError: Error | null = null;
  for (const params of attempts) {
    try {
      const data = await getJsonWithRetry(
        "https://api.scrapingdog.com/google_local",
        params,
        2,
      );
      const results = parseLocalPayload(data);
      if (results.length > 0) return results;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }

  // Stable fallback: maps pack at the storefront coordinates.
  try {
    return await mapsSearch({
      query: phrase,
      lat: input.lat,
      lng: input.lng,
      zoom: 14,
    });
  } catch (error) {
    throw (
      lastError ?? (error instanceof Error ? error : new Error(String(error)))
    );
  }
}

/** First page of Maps photos; `hasMore` when pagination token is present. */
export async function mapsPhotosCount(
  dataId: string,
): Promise<ScrapingDogPhotosCount> {
  const id = dataId.trim();
  if (!id) return { count: 0, hasMore: false };

  const data = await getJsonWithRetry(
    "https://api.scrapingdog.com/google_maps/photos",
    {
      api_key: getApiKey(),
      data_id: id,
      language: "pl",
    },
    2,
  );

  const root = asRecord(data) ?? {};
  const photos = Array.isArray(root.photos) ? root.photos : [];
  const pagination = asRecord(root.scrapingdog_pagination);
  const nextToken =
    (pagination && readString(pagination, "next_page_token")) ||
    readString(root, "next_page_token");
  return {
    count: photos.length,
    hasMore: Boolean(nextToken),
  };
}
