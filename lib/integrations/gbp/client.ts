import { GbpHttpError } from "@/lib/integrations/gbp/errors";
import { gbpFetch } from "@/lib/integrations/gbp/fetch";
import { encryptSecret, decryptSecret } from "@/lib/crypto/secrets";

const GBP_SCOPES = [
  "https://www.googleapis.com/auth/business.manage",
  "openid",
  "email",
  "profile",
].join(" ");

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

export function getGbpAuthUrl(state: string): string {
  const clientId = requireEnv("GOOGLE_CLIENT_ID");
  const redirectUri = requireEnv("GOOGLE_REDIRECT_URI");
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GBP_SCOPES,
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export type GoogleTokenSet = {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date | null;
  scope?: string;
};

export async function exchangeGbpCode(code: string): Promise<GoogleTokenSet> {
  const clientId = requireEnv("GOOGLE_CLIENT_ID");
  const clientSecret = requireEnv("GOOGLE_CLIENT_SECRET");
  const redirectUri = requireEnv("GOOGLE_REDIRECT_URI");

  const response = await gbpFetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Google token exchange failed: ${body}`);
  }

  const data = (await response.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
  };

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? null,
    expiresAt: data.expires_in
      ? new Date(Date.now() + data.expires_in * 1000)
      : null,
    scope: data.scope,
  };
}

export async function refreshGbpAccessToken(
  encryptedRefreshToken: string,
): Promise<GoogleTokenSet> {
  const clientId = requireEnv("GOOGLE_CLIENT_ID");
  const clientSecret = requireEnv("GOOGLE_CLIENT_SECRET");
  const refreshToken = decryptSecret(encryptedRefreshToken);

  const response = await gbpFetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Google token refresh failed: ${body}`);
  }

  const data = (await response.json()) as {
    access_token: string;
    expires_in?: number;
    scope?: string;
  };

  return {
    accessToken: data.access_token,
    refreshToken: refreshToken,
    expiresAt: data.expires_in
      ? new Date(Date.now() + data.expires_in * 1000)
      : null,
    scope: data.scope,
  };
}

export function sealTokens(tokens: GoogleTokenSet) {
  return {
    encryptedAccessToken: encryptSecret(tokens.accessToken),
    encryptedRefreshToken: tokens.refreshToken
      ? encryptSecret(tokens.refreshToken)
      : null,
    expiresAt: tokens.expiresAt,
    scopes: tokens.scope ?? GBP_SCOPES,
  };
}

export type GbpLocation = {
  name: string;
  title: string;
  storefrontAddress?: string;
  raw: unknown;
};

type AccountsListResponse = {
  accounts?: Array<{ name: string; accountName?: string }>;
};

type LocationsListResponse = {
  locations?: Array<{
    name: string;
    title?: string;
    storefrontAddress?: { addressLines?: string[]; locality?: string };
  }>;
  nextPageToken?: string;
};

export async function listGbpLocations(
  accessToken: string,
): Promise<GbpLocation[]> {
  const accountsRes = await gbpFetch(
    "https://mybusinessaccountmanagement.googleapis.com/v1/accounts",
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );

  if (!accountsRes.ok) {
    const body = await accountsRes.text();
    throw new Error(`GBP accounts.list failed: ${body}`);
  }

  const accountsData = (await accountsRes.json()) as AccountsListResponse;
  const accounts = accountsData.accounts ?? [];
  const locations: GbpLocation[] = [];

  for (const account of accounts) {
    let pageToken: string | undefined;
    do {
      const url = new URL(
        `https://mybusinessbusinessinformation.googleapis.com/v1/${account.name}/locations`,
      );
      url.searchParams.set("readMask", "name,title,storefrontAddress");
      url.searchParams.set("pageSize", "100");
      if (pageToken) url.searchParams.set("pageToken", pageToken);

      const locRes = await gbpFetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!locRes.ok) {
        const body = await locRes.text();
        throw new Error(`GBP locations.list failed: ${body}`);
      }

      const locData = (await locRes.json()) as LocationsListResponse;
      for (const loc of locData.locations ?? []) {
        const addressParts = [
          ...(loc.storefrontAddress?.addressLines ?? []),
          loc.storefrontAddress?.locality,
        ].filter(Boolean);
        locations.push({
          name: loc.name,
          title: loc.title ?? loc.name,
          storefrontAddress: addressParts.join(", ") || undefined,
          raw: loc,
        });
      }
      pageToken = locData.nextPageToken;
    } while (pageToken);
  }

  return locations;
}

/** Listing fields the panel reads (location.get and getGoogleUpdated). */
const LOCATION_READ_MASK = [
  "name",
  "title",
  "storefrontAddress",
  "websiteUri",
  "phoneNumbers",
  "regularHours",
  "specialHours",
  "moreHours",
  "categories",
  "profile",
  "serviceItems",
  "latlng",
  "metadata",
  "openInfo",
  "serviceArea",
  "labels",
].join(",");

export type GbpGoogleUpdated = {
  /** The listing as customers see it in Google Search and Maps. */
  location: Record<string, unknown>;
  /** Fields where Google's version differs from the owner's. */
  diffMask: string[];
  /** Fields with the owner's edits still under review by Google. */
  pendingMask: string[];
};

function splitMask(value: unknown): string[] {
  return typeof value === "string" && value
    ? value
        .split(",")
        .map((path) => path.trim())
        .filter(Boolean)
    : [];
}

/**
 * Google's version of the listing (getGoogleUpdated): what customers see,
 * which fields Google changed and which owner edits wait for review.
 */
export async function fetchGbpGoogleUpdated(
  accessToken: string,
  locationName: string,
): Promise<GbpGoogleUpdated> {
  const url = new URL(
    `https://mybusinessbusinessinformation.googleapis.com/v1/${locationName}:getGoogleUpdated`,
  );
  url.searchParams.set("readMask", LOCATION_READ_MASK);

  const response = await gbpFetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    throw new GbpHttpError(
      "GBP getGoogleUpdated",
      response.status,
      await response.text(),
    );
  }
  const data = (await response.json()) as {
    location?: Record<string, unknown>;
    diffMask?: string;
    pendingMask?: string;
  };
  return {
    location: data.location ?? {},
    diffMask: splitMask(data.diffMask),
    pendingMask: splitMask(data.pendingMask),
  };
}

export async function fetchGbpLocationDetails(
  accessToken: string,
  locationName: string,
): Promise<Record<string, unknown>> {
  const url = new URL(
    `https://mybusinessbusinessinformation.googleapis.com/v1/${locationName}`,
  );
  url.searchParams.set("readMask", LOCATION_READ_MASK);

  const response = await gbpFetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GBP location get failed: ${body}`);
  }

  return (await response.json()) as Record<string, unknown>;
}

export async function patchGbpLocation(
  accessToken: string,
  locationName: string,
  body: Record<string, unknown>,
  updateMask: string[],
  options?: { validateOnly?: boolean },
): Promise<Record<string, unknown>> {
  if (updateMask.length === 0) {
    throw new Error("updateMask cannot be empty");
  }

  const url = new URL(
    `https://mybusinessbusinessinformation.googleapis.com/v1/${locationName}`,
  );
  url.searchParams.set("updateMask", updateMask.join(","));
  if (options?.validateOnly) {
    url.searchParams.set("validateOnly", "true");
  }

  const response = await gbpFetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GBP location patch failed: ${text}`);
  }

  return (await response.json()) as Record<string, unknown>;
}

export type GbpCategory = {
  name: string;
  displayName: string;
  serviceTypes?: Array<{ serviceTypeId: string; displayName: string }>;
};

type CategoriesResponse = {
  categories?: Array<{
    name?: string;
    displayName?: string;
    serviceTypes?: Array<{ serviceTypeId?: string; displayName?: string }>;
  }>;
  nextPageToken?: string;
};

function parseCategories(data: CategoriesResponse): GbpCategory[] {
  return (data.categories ?? [])
    .filter((c) => c.name && c.displayName)
    .map((c) => ({
      name: c.name!,
      displayName: c.displayName!,
      serviceTypes: (c.serviceTypes ?? [])
        .filter((s) => s.serviceTypeId && s.displayName)
        .map((s) => ({
          serviceTypeId: s.serviceTypeId!,
          displayName: s.displayName!,
        })),
    }));
}

/** Google caps categories.list at 100 per page. */
const CATEGORIES_PAGE_SIZE = 100;
/** Safety cap - the PL dictionary is a few thousand entries (tens of pages). */
const CATEGORIES_MAX_PAGES = 100;

/** The whole PL category dictionary, all pages. */
export async function listGbpCategories(
  accessToken: string,
): Promise<GbpCategory[]> {
  const collected: GbpCategory[] = [];
  let pageToken: string | undefined;

  for (let page = 0; page < CATEGORIES_MAX_PAGES; page++) {
    const url = new URL(
      "https://mybusinessbusinessinformation.googleapis.com/v1/categories",
    );
    url.searchParams.set("regionCode", "PL");
    url.searchParams.set("languageCode", "pl");
    url.searchParams.set("view", "FULL");
    url.searchParams.set("pageSize", String(CATEGORIES_PAGE_SIZE));
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const response = await gbpFetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`GBP categories.list failed: ${body}`);
    }

    const data = (await response.json()) as CategoriesResponse;
    collected.push(...parseCategories(data));
    pageToken = data.nextPageToken;
    if (!pageToken) return collected;
  }

  console.error(
    `GBP categories.list: przerwano po ${CATEGORIES_MAX_PAGES} stronach (${collected.length} kategorii)`,
  );
  return collected;
}

export async function batchGetGbpCategories(
  accessToken: string,
  categoryNames: string[],
): Promise<GbpCategory[]> {
  if (categoryNames.length === 0) return [];

  const url = new URL(
    "https://mybusinessbusinessinformation.googleapis.com/v1/categories:batchGet",
  );
  url.searchParams.set("regionCode", "PL");
  url.searchParams.set("languageCode", "pl");
  url.searchParams.set("view", "FULL");
  for (const name of categoryNames) {
    url.searchParams.append("names", name);
  }

  const response = await gbpFetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GBP categories.batchGet failed: ${body}`);
  }

  return parseCategories((await response.json()) as CategoriesResponse);
}

export type GbpAttributeMetadata = {
  parent: string;
  valueType?: string;
  displayName?: string;
  groupDisplayName?: string;
  repeatable?: boolean;
  deprecated?: boolean;
  valueMetadata?: Array<{ value?: string | boolean; displayName?: string }>;
};

export async function listGbpAttributesForCategory(
  accessToken: string,
  categoryName: string,
): Promise<GbpAttributeMetadata[]> {
  return listGbpAttributeMetadata(accessToken, {
    categoryName,
    regionCode: "PL",
    languageCode: "pl",
  });
}

/** Attributes actually available for this listing (primary category + country). */
export async function listGbpAttributesForLocation(
  accessToken: string,
  locationName: string,
): Promise<GbpAttributeMetadata[]> {
  return listGbpAttributeMetadata(accessToken, { parent: locationName });
}

async function listGbpAttributeMetadata(
  accessToken: string,
  params: {
    parent?: string;
    categoryName?: string;
    regionCode?: string;
    languageCode?: string;
  },
): Promise<GbpAttributeMetadata[]> {
  const collected: GbpAttributeMetadata[] = [];
  let pageToken: string | undefined;

  do {
    const url = new URL(
      "https://mybusinessbusinessinformation.googleapis.com/v1/attributes",
    );
    if (params.parent) {
      url.searchParams.set("parent", params.parent);
    } else {
      if (params.categoryName) {
        url.searchParams.set("categoryName", params.categoryName);
      }
      if (params.regionCode) {
        url.searchParams.set("regionCode", params.regionCode);
      }
      if (params.languageCode) {
        url.searchParams.set("languageCode", params.languageCode);
      }
    }
    url.searchParams.set("pageSize", "200");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const response = await gbpFetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`GBP attributes.list failed: ${body}`);
    }

    const data = (await response.json()) as {
      attributeMetadata?: GbpAttributeMetadata[];
      nextPageToken?: string;
    };
    collected.push(...(data.attributeMetadata ?? []));
    pageToken = data.nextPageToken;
  } while (pageToken);

  return collected;
}

export async function getGbpLocationAttributes(
  accessToken: string,
  locationName: string,
): Promise<{ name?: string; attributes?: Array<Record<string, unknown>> }> {
  const response = await gbpFetch(
    `https://mybusinessbusinessinformation.googleapis.com/v1/${locationName}/attributes`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GBP getAttributes failed: ${body}`);
  }

  return (await response.json()) as {
    name?: string;
    attributes?: Array<Record<string, unknown>>;
  };
}

export async function updateGbpLocationAttributes(
  accessToken: string,
  locationName: string,
  attributes: Array<Record<string, unknown>>,
  attributeMask: string[],
): Promise<unknown> {
  const url = new URL(
    `https://mybusinessbusinessinformation.googleapis.com/v1/${locationName}/attributes`,
  );
  if (attributeMask.length) {
    url.searchParams.set("attributeMask", attributeMask.join(","));
  }

  const response = await gbpFetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: `${locationName}/attributes`,
      attributes,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GBP updateAttributes failed: ${body}`);
  }

  return response.json();
}

export type DailyMetric =
  | "BUSINESS_IMPRESSIONS_DESKTOP_MAPS"
  | "BUSINESS_IMPRESSIONS_DESKTOP_SEARCH"
  | "BUSINESS_IMPRESSIONS_MOBILE_MAPS"
  | "BUSINESS_IMPRESSIONS_MOBILE_SEARCH"
  | "CALL_CLICKS"
  | "WEBSITE_CLICKS"
  | "BUSINESS_DIRECTION_REQUESTS"
  | "BUSINESS_CONVERSATIONS"
  | "BUSINESS_BOOKINGS"
  | "BUSINESS_FOOD_ORDERS"
  | "BUSINESS_FOOD_MENU_CLICKS";

export async function fetchGbpMultiDailyMetrics(
  accessToken: string,
  locationName: string,
  metrics: DailyMetric[],
  start: { year: number; month: number; day: number },
  end: { year: number; month: number; day: number },
): Promise<unknown> {
  const url = new URL(
    `https://businessprofileperformance.googleapis.com/v1/${locationName}:fetchMultiDailyMetricsTimeSeries`,
  );
  for (const metric of metrics) {
    url.searchParams.append("dailyMetrics", metric);
  }
  url.searchParams.set("dailyRange.start_date.year", String(start.year));
  url.searchParams.set("dailyRange.start_date.month", String(start.month));
  url.searchParams.set("dailyRange.start_date.day", String(start.day));
  url.searchParams.set("dailyRange.end_date.year", String(end.year));
  url.searchParams.set("dailyRange.end_date.month", String(end.month));
  url.searchParams.set("dailyRange.end_date.day", String(end.day));

  const response = await gbpFetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GBP performance metrics failed: ${body}`);
  }

  return response.json();
}

export type GbpMediaItem = {
  name?: string;
  mediaFormat?: string;
  locationAssociation?: { category?: string };
  googleUrl?: string;
  thumbnailUrl?: string;
};

/**
 * Legacy v4 media list. locationName is v1 form `locations/{id}`;
 * we resolve `accounts/{aid}/locations/{id}` via Account Management.
 */
type MediaListResponse = {
  mediaItems?: GbpMediaItem[];
  nextPageToken?: string;
};

/** Owner media or customer photos of one v4 location, up to `limit` items. */
async function listMediaCollection(
  accessToken: string,
  endpoint: string,
  limit: number,
): Promise<GbpMediaItem[]> {
  const items: GbpMediaItem[] = [];
  let pageToken: string | undefined;

  for (let page = 0; page < 3 && items.length < limit; page++) {
    const url = new URL(endpoint);
    url.searchParams.set("pageSize", "50");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const response = await gbpFetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) {
      if (page > 0) return items;
      throw new GbpHttpError(
        "GBP media.list",
        response.status,
        await response.text(),
      );
    }

    const data = (await response.json()) as MediaListResponse;
    items.push(...(data.mediaItems ?? []));
    pageToken = data.nextPageToken;
    if (!pageToken) break;
  }

  return items;
}

/** Account Management: `accounts/{id}` names the token can see (v4 APIs need them). */
async function listGbpAccountNames(accessToken: string): Promise<string[]> {
  const accountsRes = await gbpFetch(
    "https://mybusinessaccountmanagement.googleapis.com/v1/accounts",
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!accountsRes.ok) {
    throw new Error(`GBP accounts.list failed: ${await accountsRes.text()}`);
  }

  const accountsData = (await accountsRes.json()) as AccountsListResponse;
  return (accountsData.accounts ?? []).map((account) => account.name);
}

export type GbpLocationMedia = {
  owner: GbpMediaItem[];
  customers: GbpMediaItem[];
};

/**
 * Photos of a location by its v4 name (`accounts/{a}/locations/{l}`, see
 * `withGbpV4LocationName`). Throws GbpHttpError when Google refuses the name.
 */
export async function listGbpLocationMedia(
  accessToken: string,
  v4LocationName: string,
): Promise<GbpLocationMedia> {
  const parent = `https://mybusiness.googleapis.com/v4/${v4LocationName}/media`;
  const owner = await listMediaCollection(accessToken, parent, 40);
  let customers: GbpMediaItem[] = [];
  try {
    customers = await listMediaCollection(
      accessToken,
      `${parent}/customers`,
      40,
    );
  } catch {
    // Customer photos are optional - the owner list is what matters.
  }
  return { owner, customers };
}

function mediaDisplayUrl(item: GbpMediaItem): string | null {
  const raw = item.thumbnailUrl || item.googleUrl;
  if (!raw) return null;
  if (!/googleusercontent\.com/i.test(raw)) return raw;
  if (/=[swh]\d/.test(raw)) return raw;
  return `${raw}=w800-h800-c`;
}

const MEDIA_CATEGORY_RANK: Record<string, number> = {
  COVER: 0,
  PROFILE: 1,
  LOGO: 2,
  EXTERIOR: 3,
  INTERIOR: 4,
  PRODUCT: 5,
  FOOD_AND_DRINK: 6,
  ADDITIONAL: 7,
};

function isGbpPhotoItem(item: GbpMediaItem): boolean {
  if (item.mediaFormat && item.mediaFormat !== "PHOTO") return false;
  return Boolean(item.googleUrl || item.thumbnailUrl);
}

/** Owner-uploaded photos only (excludes customer media and video). */
export function countGbpOwnerPhotos(items: GbpMediaItem[]): number {
  return items.filter(isGbpPhotoItem).length;
}

/** Cover first, then other photos. Skips video. */
export function pickGbpCollageUrls(items: GbpMediaItem[], limit = 6): string[] {
  const photos = items.filter(isGbpPhotoItem);

  photos.sort((a, b) => {
    const rankA =
      MEDIA_CATEGORY_RANK[a.locationAssociation?.category ?? ""] ?? 8;
    const rankB =
      MEDIA_CATEGORY_RANK[b.locationAssociation?.category ?? ""] ?? 8;
    return rankA - rankB;
  });

  const urls: string[] = [];
  const seen = new Set<string>();
  for (const item of photos) {
    const url = mediaDisplayUrl(item);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    urls.push(url);
    if (urls.length >= limit) break;
  }
  return urls;
}

/**
 * v4 `accounts/{aid}/locations/{id}` for a v1 `locations/{id}` - same account
 * probing as listGbpLocationMedia (the account that can list the location's posts owns it).
 */
export async function resolveGbpV4LocationName(
  accessToken: string,
  locationName: string,
): Promise<string | null> {
  const locationId = locationName.replace(/^locations\//, "");
  if (!locationId) return null;

  for (const accountName of await listGbpAccountNames(accessToken)) {
    const candidate = `${accountName}/locations/${locationId}`;
    const url = new URL(
      `https://mybusiness.googleapis.com/v4/${candidate}/localPosts`,
    );
    url.searchParams.set("pageSize", "1");
    const response = await gbpFetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (response.ok) return candidate;
    if (response.status === 401) {
      throw new Error(`GBP localPosts.list failed: ${await response.text()}`);
    }
  }
  return null;
}

export type GbpCallToActionType =
  "BOOK" | "ORDER" | "SHOP" | "LEARN_MORE" | "SIGN_UP" | "CALL";

export type GbpLocalPostInput = {
  summary: string;
  /** Public HTTPS image URL - Google fetches it itself; bytes are not accepted. */
  imageUrl?: string | null;
  callToAction?: { actionType: GbpCallToActionType; url?: string } | null;
};

/**
 * Publishes a STANDARD post (v4 localPosts) under the v4 location name
 * (see `withGbpV4LocationName`). Returns the post `name`.
 */
export async function createGbpLocalPost(
  accessToken: string,
  v4LocationName: string,
  input: GbpLocalPostInput,
): Promise<{ name: string }> {
  const parent = v4LocationName;

  const body: Record<string, unknown> = {
    languageCode: "pl",
    summary: input.summary,
    topicType: "STANDARD",
  };
  if (input.callToAction) body.callToAction = input.callToAction;
  if (input.imageUrl) {
    body.media = [{ mediaFormat: "PHOTO", sourceUrl: input.imageUrl }];
  }

  const response = await gbpFetch(
    `https://mybusiness.googleapis.com/v4/${parent}/localPosts`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );

  if (!response.ok) {
    throw new GbpHttpError(
      "GBP localPosts.create",
      response.status,
      await response.text(),
    );
  }

  const data = (await response.json()) as { name?: string };
  if (!data.name) {
    throw new Error("GBP localPosts.create failed: brak name w odpowiedzi");
  }
  return { name: data.name };
}

/** Hook point for Phase 3 - GBP analysis after connect (non-blocking). */
export async function scheduleGbpAnalysis(profileId: string): Promise<void> {
  // TODO: przenieść do kolejki BullMQ (Faza 5)
  try {
    const { enqueueGbpAuditForProfile } =
      await import("@/features/wizytowka/audit");
    await enqueueGbpAuditForProfile(profileId);
  } catch (error) {
    console.error("GBP audit enqueue after onboarding failed:", error);
  }
}
