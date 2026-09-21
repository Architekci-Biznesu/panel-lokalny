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
    "name,title,storefrontAddress,websiteUri,phoneNumbers,regularHours,categories,profile,serviceItems,latlng,metadata",
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

/** Hook point for Phase 3 - GBP analysis after connect. No-op in Phase 2. */
export async function scheduleGbpAnalysis(_profileId: string): Promise<void> {
  // Phase 3 will enqueue background analysis here.
}
