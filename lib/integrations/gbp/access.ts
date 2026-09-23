import { and, eq } from "drizzle-orm";
import { decryptSecret } from "@/lib/crypto/secrets";
import { db } from "@/lib/db";
import { oauthConnections, type Profile } from "@/lib/db/schema";
import {
  refreshGbpAccessToken,
  sealTokens,
} from "@/lib/integrations/gbp/client";
import { getActiveProfile } from "@/lib/session";

export class GbpNotConnectedError extends Error {
  constructor(message = "Profil nie ma podłączonej wizytówki Google") {
    super(message);
    this.name = "GbpNotConnectedError";
  }
}

export async function getActiveGbpProfile(): Promise<Profile> {
  const profile = await getActiveProfile();
  if (!profile.gbpLocationId || !profile.oauthConnectionId) {
    throw new GbpNotConnectedError();
  }
  return profile;
}

export function isGbpUnauthenticatedError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : "";
  return (
    message.includes("UNAUTHENTICATED") || message.includes('"code": 401')
  );
}

/** Returns a fresh access token for the profile's OAuth connection. */
export async function getGbpAccessTokenForProfile(
  profile: Profile,
  options?: { force?: boolean },
): Promise<string> {
  if (!profile.oauthConnectionId) {
    throw new GbpNotConnectedError();
  }

  const [connection] = await db
    .select()
    .from(oauthConnections)
    .where(
      and(
        eq(oauthConnections.id, profile.oauthConnectionId),
        eq(oauthConnections.accountId, profile.accountId),
      ),
    )
    .limit(1);

  if (!connection) {
    throw new GbpNotConnectedError("Brak połączenia OAuth Google");
  }

  const needsRefresh =
    options?.force ||
    !connection.expiresAt ||
    connection.expiresAt.getTime() < Date.now() + 60_000;

  if (!needsRefresh) {
    return decryptSecret(connection.encryptedAccessToken);
  }

  if (!connection.encryptedRefreshToken) {
    throw new GbpNotConnectedError(
      "Sesja Google wygasła - połącz wizytówkę ponownie",
    );
  }

  let refreshed;
  try {
    refreshed = await refreshGbpAccessToken(connection.encryptedRefreshToken);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (
      message.includes("invalid_grant") ||
      message.includes("invalid_token") ||
      message.includes("unauthorized_client")
    ) {
      throw new GbpNotConnectedError(
        "Sesja Google wygasła - połącz wizytówkę ponownie",
      );
    }
    throw error;
  }
  const sealed = sealTokens(refreshed);
  await db
    .update(oauthConnections)
    .set({
      encryptedAccessToken: sealed.encryptedAccessToken,
      expiresAt: sealed.expiresAt,
      updatedAt: new Date(),
    })
    .where(eq(oauthConnections.id, connection.id));

  return refreshed.accessToken;
}
