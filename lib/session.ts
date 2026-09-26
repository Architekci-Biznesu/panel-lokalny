import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  companyContext,
  onboardingDrafts,
  profileGroups,
  profiles,
  publishGroups,
  users,
  type Profile,
} from "@/lib/db/schema";

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
    const fallbackId = await resolveSwitcherProfileId(null);
    const ready = await listAccountProfiles();
    const fallback = ready.find((item) => item.id === fallbackId);
    if (!fallback) {
      throw new AuthError("Profil nie należy do aktywnego konta", 403);
    }
    return fallback;
  }

  const hidden = await onboardingDraftProfileIds(accountId);
  if (!hidden.has(profile.id)) {
    return profile;
  }

  const fallbackId = await resolveSwitcherProfileId(null);
  const ready = await listAccountProfiles();
  const fallback = ready.find((item) => item.id === fallbackId);
  if (!fallback) {
    throw new AuthError("Brak aktywnego profilu", 403);
  }

  return fallback;
}

/**
 * Verifies that a profileId from the request belongs to the active account.
 */
export async function requireOwnedProfile(profileId: string): Promise<Profile> {
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

async function onboardingDraftProfileIds(
  accountId: string,
): Promise<Set<string>> {
  const drafts = await db
    .select({ profileId: onboardingDrafts.profileId })
    .from(onboardingDrafts)
    .where(eq(onboardingDrafts.accountId, accountId));

  return new Set(
    drafts.flatMap((draft) => (draft.profileId ? [draft.profileId] : [])),
  );
}

/** Finished profiles only. A row still tied to an open onboarding draft stays hidden. */
export async function listAccountProfiles(): Promise<Profile[]> {
  const accountId = await getActiveAccountId();
  const hidden = await onboardingDraftProfileIds(accountId);

  const rows = await db
    .select()
    .from(profiles)
    .where(eq(profiles.accountId, accountId))
    .orderBy(asc(profiles.createdAt));

  return rows.filter((profile) => !hidden.has(profile.id));
}

export type AccountProfileOption = {
  id: string;
  name: string;
  location: string | null;
  groupId: string | null;
  groupName: string | null;
};

function locationLabel(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") return null;
  const address = (
    raw as {
      storefrontAddress?: {
        locality?: string;
        addressLines?: string[];
      };
    }
  ).storefrontAddress;
  if (address && typeof address === "object") {
    const locality = address.locality?.trim();
    const line = address.addressLines?.find((item) => item.trim())?.trim();
    if (line && locality) return `${line}, ${locality}`;
    if (locality) return locality;
    if (line) return line;
  }
  const places = (
    raw as {
      serviceArea?: { places?: { placeInfos?: Array<{ placeName?: string }> } };
    }
  ).serviceArea?.places?.placeInfos;
  const place = places
    ?.find((item) => item.placeName?.trim())
    ?.placeName?.trim();
  return place || null;
}

/** Finished profiles with a short place line from the saved Google location. */
export async function listAccountProfileOptions(): Promise<
  AccountProfileOption[]
> {
  const rows = await listAccountProfiles();
  if (rows.length === 0) return [];

  const contexts = await db
    .select({
      profileId: companyContext.profileId,
      rawData: companyContext.rawData,
    })
    .from(companyContext)
    .where(
      and(
        eq(companyContext.source, "gbp"),
        inArray(
          companyContext.profileId,
          rows.map((row) => row.id),
        ),
      ),
    )
    .orderBy(desc(companyContext.fetchedAt));

  const labels = new Map<string, string>();
  for (const ctx of contexts) {
    if (labels.has(ctx.profileId)) continue;
    const label = locationLabel(ctx.rawData);
    if (label) labels.set(ctx.profileId, label);
  }

  const groupRows = await db
    .select({
      profileId: profileGroups.profileId,
      groupId: publishGroups.id,
      groupName: publishGroups.name,
    })
    .from(profileGroups)
    .innerJoin(publishGroups, eq(publishGroups.id, profileGroups.groupId))
    .where(
      inArray(
        profileGroups.profileId,
        rows.map((row) => row.id),
      ),
    );

  const groups = new Map<
    string,
    { groupId: string; groupName: string }
  >();
  for (const row of groupRows) {
    groups.set(row.profileId, {
      groupId: row.groupId,
      groupName: row.groupName,
    });
  }

  return rows.map((row) => {
    const group = groups.get(row.id);
    return {
      id: row.id,
      name: row.name,
      location: labels.get(row.id) ?? null,
      groupId: group?.groupId ?? null,
      groupName: group?.groupName ?? null,
    };
  });
}

/** Session profile when it is finished; otherwise the newest profile that still has Google connected. */
export async function resolveSwitcherProfileId(
  sessionProfileId: string | null,
): Promise<string | null> {
  const ready = await listAccountProfiles();
  if (
    sessionProfileId &&
    ready.some((profile) => profile.id === sessionProfileId)
  ) {
    return sessionProfileId;
  }
  const withOauth = [...ready]
    .reverse()
    .find((profile) => profile.oauthConnectionId);
  return withOauth?.id ?? ready.at(-1)?.id ?? null;
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
