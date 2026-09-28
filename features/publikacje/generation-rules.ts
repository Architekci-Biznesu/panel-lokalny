/** Pure rules for background proposal generation (no DB, safe for tests). */

export const MAX_POSTS_PER_REQUEST = 3;
export const ONBOARDING_POSTS = 3;
export const ONBOARDING_IMAGES = 1;
export const MORE_POSTS = 3;

/** Window event: a generation run started outside the workspace (header button). */
export const GENERATION_STARTED_EVENT = "pub:generation-started";

export type OnboardingProfile = { profileId: string; groupId: string | null };

/**
 * One generation run per publish group (the group shares one post list;
 * author = first new profile in it) and one per ungrouped profile. Groups that
 * already have posts are skipped - they were set up before this onboarding.
 */
export function planOnboardingGeneration(
  created: OnboardingProfile[],
  groupsWithContent: ReadonlySet<string>,
): OnboardingProfile[] {
  const plan: OnboardingProfile[] = [];
  const seenGroups = new Set<string>();
  for (const profile of created) {
    if (!profile.groupId) {
      plan.push(profile);
      continue;
    }
    if (seenGroups.has(profile.groupId)) continue;
    seenGroups.add(profile.groupId);
    if (!groupsWithContent.has(profile.groupId)) plan.push(profile);
  }
  return plan;
}

/** Titles written earlier in the same run go first, so the next post picks a new topic. */
export function withRunTitles(
  recentTitles: string[],
  runTitles: string[],
): string[] {
  return [...runTitles.slice().reverse(), ...recentTitles];
}
