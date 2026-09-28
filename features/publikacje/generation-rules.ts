/** Pure rules for background proposal generation (no DB, safe for tests). */

/** Posts one chat message may ask for. */
export const MAX_POSTS_PER_REQUEST = 3;
/** Topics AI proposes at once (also after onboarding). */
export const TOPICS_BATCH = 5;
/** Topics the customer may pick for one batch of posts. */
export const MAX_TOPICS_TO_WRITE = 10;

/** 1-10 distinct topic ids, or an error message for the customer. */
export function checkTopicSelection(
  ids: string[],
): { ok: true; ids: string[] } | { ok: false; error: string } {
  const unique = [...new Set(ids)];
  if (unique.length === 0)
    return { ok: false, error: "Wybierz co najmniej jeden temat" };
  if (unique.length > MAX_TOPICS_TO_WRITE) {
    return {
      ok: false,
      error: `Możesz wybrać maks. ${MAX_TOPICS_TO_WRITE} tematów naraz`,
    };
  }
  return { ok: true, ids: unique };
}

export type OnboardingProfile = { profileId: string; groupId: string | null };

/**
 * One generation run per publish group (the group shares one list; author =
 * first new profile in it) and one per ungrouped profile. Groups that already
 * have posts or topics are skipped - they were set up before this onboarding.
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
