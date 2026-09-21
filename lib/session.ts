import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { profiles, type Profile } from "@/lib/db/schema";

export class AuthError extends Error {
  constructor(
    message: string,
    public status: number = 401,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

/**
 * Single place that resolves the active account.
 * Admin impersonation (phase 2b) will live only here.
 */
export async function getActiveAccountId(): Promise<string> {
  const session = await auth();
  const accountId = session?.user?.accountId;

  if (!accountId) {
    throw new AuthError("Brak aktywnej sesji", 401);
  }

  return accountId;
}

/**
 * Returns the active profile only if it belongs to the active account.
 */
export async function getActiveProfile(): Promise<Profile> {
  const accountId = await getActiveAccountId();
  const session = await auth();
  const profileId = session?.user?.activeProfileId;

  if (!profileId) {
    throw new AuthError("Brak aktywnego profilu", 403);
  }

  const [profile] = await db
    .select()
    .from(profiles)
    .where(and(eq(profiles.id, profileId), eq(profiles.accountId, accountId)))
    .limit(1);

  if (!profile) {
    throw new AuthError("Profil nie należy do aktywnego konta", 403);
  }

  return profile;
}

/**
 * Verifies that a profileId from the request belongs to the active account.
 */
export async function requireOwnedProfile(
  profileId: string,
): Promise<Profile> {
  const accountId = await getActiveAccountId();

  const [profile] = await db
    .select()
    .from(profiles)
    .where(and(eq(profiles.id, profileId), eq(profiles.accountId, accountId)))
    .limit(1);

  if (!profile) {
    throw new AuthError("Profil nie należy do aktywnego konta", 403);
  }

  return profile;
}

export async function listAccountProfiles(): Promise<Profile[]> {
  const accountId = await getActiveAccountId();

  return db
    .select()
    .from(profiles)
    .where(eq(profiles.accountId, accountId));
}
