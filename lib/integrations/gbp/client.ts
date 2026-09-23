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

  const response = await fetch("https://oauth2.googleapis.com/token", {
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

  const response = await fetch("https://oauth2.googleapis.com/token", {
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
  const accountsRes = await fetch(
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

      const locRes = await fetch(url, {
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

export async function fetchGbpLocationDetails(
  accessToken: string,
  locationName: string,
): Promise<Record<string, unknown>> {
  const url = new URL(
    `https://mybusinessbusinessinformation.googleapis.com/v1/${locationName}`,
  );
  url.searchParams.set(
    "readMask",
    [
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
    ].join(","),
  );

  const response = await fetch(url, {
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

  const response = await fetch(url, {
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

export async function listGbpCategories(
  accessToken: string,
): Promise<GbpCategory[]> {
  const url = new URL(
    "https://mybusinessbusinessinformation.googleapis.com/v1/categories",
  );
  url.searchParams.set("regionCode", "PL");
  url.searchParams.set("languageCode", "pl");
  url.searchParams.set("view", "FULL");

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GBP categories.list failed: ${body}`);
  }

  const data = (await response.json()) as {
    categories?: Array<{
      name?: string;
      displayName?: string;
      serviceTypes?: Array<{ serviceTypeId?: string; displayName?: string }>;
    }>;
  };

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

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GBP categories.batchGet failed: ${body}`);
  }

  const data = (await response.json()) as {
    categories?: Array<{
      name?: string;
      displayName?: string;
      serviceTypes?: Array<{ serviceTypeId?: string; displayName?: string }>;
    }>;
  };

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

export type GbpAttributeMetadata = {
  parent: string;
  valueType?: string;
  displayName?: string;
  groupDisplayName?: string;
  repeatable?: boolean;
  valueMetadata?: Array<{ value?: string; displayName?: string }>;
};

export async function listGbpAttributesForCategory(
  accessToken: string,
  categoryName: string,
): Promise<GbpAttributeMetadata[]> {
  const url = new URL(
    "https://mybusinessbusinessinformation.googleapis.com/v1/attributes",
  );
  url.searchParams.set("categoryName", categoryName);
  url.searchParams.set("regionCode", "PL");
  url.searchParams.set("languageCode", "pl");

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GBP attributes.list failed: ${body}`);
  }

  const data = (await response.json()) as {
    attributeMetadata?: GbpAttributeMetadata[];
  };
  return data.attributeMetadata ?? [];
}

export async function getGbpLocationAttributes(
  accessToken: string,
  locationName: string,
): Promise<{ name?: string; attributes?: Array<Record<string, unknown>> }> {
  const response = await fetch(
    `https://mybusinessbusinessinformation.googleapis.com/v1/${locationName}:getAttributes`,
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
    `https://mybusinessbusinessinformation.googleapis.com/v1/${locationName}:updateAttributes`,
  );
  if (attributeMask.length) {
    url.searchParams.set("attributeMask", attributeMask.join(","));
  }

  const response = await fetch(url, {
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
  | "BUSINESS_DIRECTION_REQUESTS";

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

  const response = await fetch(url, {
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
export async function listGbpLocationMedia(
  accessToken: string,
  locationName: string,
): Promise<GbpMediaItem[]> {
  const locationId = locationName.replace(/^locations\//, "");
  if (!locationId) return [];

  const accountsRes = await fetch(
    "https://mybusinessaccountmanagement.googleapis.com/v1/accounts",
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!accountsRes.ok) {
    throw new Error(`GBP accounts.list failed: ${await accountsRes.text()}`);
  }

  const accountsData = (await accountsRes.json()) as AccountsListResponse;
  const accounts = accountsData.accounts ?? [];

  for (const account of accounts) {
    const parent = `${account.name}/locations/${locationId}`;
    const response = await fetch(
      `https://mybusiness.googleapis.com/v4/${parent}/media`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!response.ok) {
      // Wrong account for this location - try next
      continue;
    }
    const data = (await response.json()) as { mediaItems?: GbpMediaItem[] };
    return data.mediaItems ?? [];
  }

  return [];
}

/** Prefer COVER, then PROFILE, then first photo with a usable URL. */
export function pickGbpCoverUrl(items: GbpMediaItem[]): string | null {
  const withUrl = items.filter((i) => i.googleUrl || i.thumbnailUrl);
  const cover = withUrl.find(
    (i) => i.locationAssociation?.category === "COVER",
  );
  if (cover) return cover.googleUrl ?? cover.thumbnailUrl ?? null;
  const profile = withUrl.find(
    (i) => i.locationAssociation?.category === "PROFILE",
  );
  if (profile) return profile.googleUrl ?? profile.thumbnailUrl ?? null;
  const first = withUrl[0];
  return first ? (first.googleUrl ?? first.thumbnailUrl ?? null) : null;
}

/** Hook point for Phase 3 - GBP analysis after connect. */
export async function scheduleGbpAnalysis(profileId: string): Promise<void> {
  // TODO: przenieść do kolejki BullMQ (Faza 5)
  try {
    const { runGbpAuditForProfile } = await import(
      "@/features/wizytowka/audit"
    );
    await runGbpAuditForProfile(profileId);
  } catch (error) {
    console.error("GBP audit after onboarding failed:", error);
  }
}
