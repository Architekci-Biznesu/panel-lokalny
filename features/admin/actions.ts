"use server";

import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { unstable_update } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  accounts,
  napInterestRequests,
  profileGroups,
  profiles,
  publishGroups,
  users,
} from "@/lib/db/schema";
import { isCurrentUserStaff, requireStaff } from "@/lib/session";

export type AdminAccountRow = {
  id: string;
  ownerEmail: string;
  createdAt: Date;
  lastActiveAt: Date | null;
  profileCount: number;
  profiles: AdminProfileRow[];
};

export type AdminProfileRow = {
  id: string;
  name: string;
  createdAt: Date;
  groupName: string | null;
};

export type AdminNapInterestRow = {
  id: string;
  createdAt: Date;
  profileId: string;
  profileName: string;
  ownerEmail: string;
};

export async function listAdminAccounts(): Promise<AdminAccountRow[]> {
  await requireStaff();

  const ownerUsers = await db
    .select({
      accountId: users.accountId,
      email: users.email,
      accountCreatedAt: accounts.createdAt,
      lastActiveAt: accounts.lastActiveAt,
    })
    .from(users)
    .innerJoin(accounts, eq(accounts.id, users.accountId))
    .where(and(eq(users.role, "owner"), eq(users.isStaff, false)))
    .orderBy(desc(accounts.createdAt));

  if (ownerUsers.length === 0) return [];

  const accountIds = ownerUsers.map((u) => u.accountId);

  const allProfiles = await db
    .select({
      id: profiles.id,
      name: profiles.name,
      accountId: profiles.accountId,
      createdAt: profiles.createdAt,
      groupName: publishGroups.name,
    })
    .from(profiles)
    .leftJoin(profileGroups, eq(profileGroups.profileId, profiles.id))
    .leftJoin(publishGroups, eq(publishGroups.id, profileGroups.groupId))
    .where(inArray(profiles.accountId, accountIds))
    .orderBy(asc(profiles.createdAt));

  const profilesByAccount = new Map<string, AdminProfileRow[]>();
  for (const p of allProfiles) {
    const list = profilesByAccount.get(p.accountId) ?? [];
    list.push({
      id: p.id,
      name: p.name,
      createdAt: p.createdAt,
      groupName: p.groupName,
    });
    profilesByAccount.set(p.accountId, list);
  }

  return ownerUsers.map((owner) => {
    const accountProfiles = profilesByAccount.get(owner.accountId) ?? [];
    return {
      id: owner.accountId,
      ownerEmail: owner.email,
      createdAt: owner.accountCreatedAt,
      lastActiveAt: owner.lastActiveAt,
      profileCount: accountProfiles.length,
      profiles: accountProfiles,
    };
  });
}

export async function listNapInterestRequests(): Promise<
  AdminNapInterestRow[]
> {
  await requireStaff();

  const rows = await db
    .select({
      id: napInterestRequests.id,
      createdAt: napInterestRequests.createdAt,
      profileId: profiles.id,
      profileName: profiles.name,
      ownerEmail: users.email,
    })
    .from(napInterestRequests)
    .innerJoin(profiles, eq(profiles.id, napInterestRequests.profileId))
    .innerJoin(accounts, eq(accounts.id, profiles.accountId))
    .innerJoin(
      users,
      and(
        eq(users.accountId, accounts.id),
        eq(users.role, "owner"),
        eq(users.isStaff, false),
      ),
    )
    .orderBy(desc(napInterestRequests.createdAt));

  return rows.map((row) => ({
    id: row.id,
    createdAt: row.createdAt,
    profileId: row.profileId,
    profileName: row.profileName,
    ownerEmail: row.ownerEmail,
  }));
}

export type AdminEnterResult = { ok: true } | { ok: false; error: string };

const enterProfileSchema = z.object({
  profileId: z.string().uuid(),
});

const enterAccountSchema = z.object({
  accountId: z.string().uuid(),
});

export async function enterAdminProfile(
  profileId: string,
): Promise<AdminEnterResult> {
  if (!(await isCurrentUserStaff())) {
    redirect("/");
  }

  const parsed = enterProfileSchema.safeParse({ profileId });
  if (!parsed.success) {
    return { ok: false, error: "Nieprawidłowy profil." };
  }

  const [profile] = await db
    .select({ id: profiles.id, accountId: profiles.accountId })
    .from(profiles)
    .where(eq(profiles.id, parsed.data.profileId))
    .limit(1);

  if (!profile) {
    return { ok: false, error: "Nie znaleziono profilu." };
  }

  const [owner] = await db
    .select({ isStaff: users.isStaff })
    .from(users)
    .where(and(eq(users.accountId, profile.accountId), eq(users.role, "owner")))
    .limit(1);

  if (!owner || owner.isStaff) {
    return {
      ok: false,
      error: "Nie można wejść w konto wewnętrzne (staff).",
    };
  }

  await unstable_update({
    user: {
      activeProfileId: profile.id,
      adminImpersonating: true,
    },
  });

  redirect("/pulpit");
}

export async function enterAdminAccount(
  accountId: string,
): Promise<AdminEnterResult> {
  if (!(await isCurrentUserStaff())) {
    redirect("/");
  }

  const parsed = enterAccountSchema.safeParse({ accountId });
  if (!parsed.success) {
    return { ok: false, error: "Nieprawidłowe konto." };
  }

  const [owner] = await db
    .select({ isStaff: users.isStaff })
    .from(users)
    .where(
      and(eq(users.accountId, parsed.data.accountId), eq(users.role, "owner")),
    )
    .limit(1);

  if (!owner || owner.isStaff) {
    return {
      ok: false,
      error: "Nie można wejść w konto wewnętrzne (staff).",
    };
  }

  const [firstProfile] = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.accountId, parsed.data.accountId))
    .orderBy(asc(profiles.createdAt))
    .limit(1);

  if (!firstProfile) {
    return { ok: false, error: "To konto nie ma jeszcze profili." };
  }

  await unstable_update({
    user: {
      activeProfileId: firstProfile.id,
      adminImpersonating: true,
    },
  });

  redirect("/pulpit");
}

export async function exitAdminMode() {
  const staff = await isCurrentUserStaff();

  await unstable_update({
    user: {
      activeProfileId: null,
      adminImpersonating: false,
    },
  });

  redirect(staff ? "/admin" : "/logowanie");
}
