/** Minimal shape of AccountProfileOption (lib/session.ts) needed here. */
export type GroupProfileOption = {
  id: string;
  name: string;
  groupId: string | null;
};

/** Other profiles in the active profile's publish group ("Publikuj też w:"). */
export function groupSiblings(
  activeProfileId: string,
  options: GroupProfileOption[],
): GroupProfileOption[] {
  const groupId = options.find(
    (option) => option.id === activeProfileId,
  )?.groupId;
  if (!groupId) return [];
  return options.filter(
    (option) => option.groupId === groupId && option.id !== activeProfileId,
  );
}

/**
 * Validates extra target profiles: each must be a sibling in the active
 * profile's publish group. `options` must come from listAccountProfileOptions()
 * (active account only), so a foreign profileId never passes.
 */
export function resolveGroupTargets(
  activeProfileId: string,
  requestedIds: string[],
  options: GroupProfileOption[],
): string[] {
  const siblings = new Set(
    groupSiblings(activeProfileId, options).map((option) => option.id),
  );
  const unique = [...new Set(requestedIds)].filter(
    (id) => id !== activeProfileId,
  );
  for (const id of unique) {
    if (!siblings.has(id)) {
      throw new Error("Wybrany profil nie należy do grupy publikacji");
    }
  }
  return unique;
}
