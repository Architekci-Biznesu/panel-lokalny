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

/** Returns a fresh access token for the profile's OAuth connection. */
export async function getGbpAccessTokenForProfile(
  profile: Profile,
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

  const refreshed = await refreshGbpAccessToken(
    connection.encryptedRefreshToken,
  );
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
