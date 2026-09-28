import { and, eq, inArray, or, type SQL } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  contentGenerationRuns,
  contentItems,
  contentTargets,
  profileGroups,
  publishGroups,
  type Profile,
} from "@/lib/db/schema";

/**
 * Which posts a profile sees: its own, its publish group's (shared list) and
 * posts published to it. The group always comes from the profile's own account.
 */
export type ContentScope = { profileId: string; groupId: string | null };

export async function loadContentScope(
  profile: Profile,
): Promise<ContentScope> {
  const [row] = await db
    .select({ groupId: profileGroups.groupId })
    .from(profileGroups)
    .innerJoin(publishGroups, eq(publishGroups.id, profileGroups.groupId))
    .where(
      and(
        eq(profileGroups.profileId, profile.id),
        eq(publishGroups.accountId, profile.accountId),
      ),
    )
    .limit(1);
  return { profileId: profile.id, groupId: row?.groupId ?? null };
}

/** Owned by the profile or shared by its group (the posts it can decide on). */
export function ownedByScope(scope: ContentScope): SQL {
  return scope.groupId
    ? or(
        eq(contentItems.profileId, scope.profileId),
        eq(contentItems.groupId, scope.groupId),
      )!
    : eq(contentItems.profileId, scope.profileId);
}

/** Owned, shared, or published to this profile (history and calendar). */
export function visibleInScope(scope: ContentScope): SQL {
  const targeted = db
    .select({ id: contentTargets.contentItemId })
    .from(contentTargets)
    .where(eq(contentTargets.profileId, scope.profileId));
  return or(ownedByScope(scope), inArray(contentItems.id, targeted))!;
}

/** Generation runs of the profile or its group. */
export function runsInScope(scope: ContentScope): SQL {
  return scope.groupId
    ? or(
        eq(contentGenerationRuns.profileId, scope.profileId),
        eq(contentGenerationRuns.groupId, scope.groupId),
      )!
    : eq(contentGenerationRuns.profileId, scope.profileId);
}
