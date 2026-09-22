import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { profiles, users, type Profile } from "@/lib/db/schema";

export class AuthError extends Error {
  constructor(
    message: string,
    public status: number = 401,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

/** Always read from DB - never from JWT. */
export async function isCurrentUserStaff(): Promise<boolean> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return false;

  const [user] = await db
    .select({ isStaff: users.isStaff })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return user?.isStaff === true;
}

export async function requireStaff(): Promise<void> {
  if (!(await isCurrentUserStaff())) {
    throw new AuthError("Brak uprawnień", 404);
  }
}

/**
 * Single place that resolves the active account.
 * Admin impersonation lives only here.
 */
export async function getActiveAccountId(): Promise<string> {
  const session = await auth();
  const ownAccountId = session?.user?.accountId;

  if (!ownAccountId) {
    throw new AuthError("Brak aktywnej sesji", 401);
  }

  if (session.user.adminImpersonating && session.user.activeProfileId) {
    if (!(await isCurrentUserStaff())) {
      throw new AuthError("Brak uprawnień", 403);
    }
    const [profile] = await db
      .select({ accountId: profiles.accountId })
      .from(profiles)
      .where(eq(profiles.id, session.user.activeProfileId))
      .limit(1);
    if (!profile) {
      throw new AuthError("Profil nie należy do aktywnego konta", 403);
    }
    return profile.accountId;
  }

  return ownAccountId;
}

/**
 * Returns the active profile only if it belongs to the active account
 * (own account, or client account while staff is impersonating).
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

/** Props for the profile switcher while in admin impersonation mode. */
export async function getAdminSwitcherProps(): Promise<{
  adminImpersonating: boolean;
  ownerEmail: string | null;
}> {
  const session = await auth();
  if (!session?.user?.adminImpersonating || !session.user.activeProfileId) {
    return { adminImpersonating: false, ownerEmail: null };
  }

  if (!(await isCurrentUserStaff())) {
    return { adminImpersonating: false, ownerEmail: null };
  }

  const [profile] = await db
    .select({ accountId: profiles.accountId })
    .from(profiles)
    .where(eq(profiles.id, session.user.activeProfileId))
    .limit(1);

  if (!profile) {
    return { adminImpersonating: false, ownerEmail: null };
  }

  const [owner] = await db
    .select({ email: users.email })
    .from(users)
    .where(and(eq(users.accountId, profile.accountId), eq(users.role, "owner")))
    .limit(1);

  return {
    adminImpersonating: true,
    ownerEmail: owner?.email ?? null,
  };
}
