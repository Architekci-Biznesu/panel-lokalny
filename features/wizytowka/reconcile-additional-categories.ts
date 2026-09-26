/** Reconcile AI additional_categories vs live list. */

function stripDiacritics(value: string): string {
  return value.normalize("NFD").replace(/\p{M}/gu, "");
}

function normalizeLabel(value: string): string {
  return stripDiacritics(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const STOP = new Set([
  "serwis",
  "uslugi",
  "usluga",
  "i",
  "oraz",
  "dla",
  "the",
  "and",
  "of",
]);

function tokens(label: string): string[] {
  return normalizeLabel(label)
    .split(" ")
    .filter((t) => t.length >= 3 && !STOP.has(t));
}

/** True when labels look like the same service (containment or shared tokens). */
export function isCategoryRefinement(oldLabel: string, neuLabel: string): boolean {
  const a = normalizeLabel(oldLabel);
  const b = normalizeLabel(neuLabel);
  if (!a || !b || a === b) return a === b && a.length > 0;
  if (b.includes(a) || a.includes(b)) return true;
  const ta = tokens(oldLabel);
  const tb = tokens(neuLabel);
  if (ta.length === 0 || tb.length === 0) return false;
  const shared = ta.filter((t) => tb.includes(t));
  return shared.length / Math.min(ta.length, tb.length) >= 0.5;
}

export function normalizeCategoryLabel(value: string): string {
  return normalizeLabel(value);
}

export function categoryLabelTokens(label: string): string[] {
  return tokens(label);
}

function isExplicitlyAvoided(
  label: string,
  name: string,
  avoidText: string,
): boolean {
  const blob = normalizeLabel(avoidText);
  if (!blob) return false;
  const labelNorm = normalizeLabel(label);
  if (labelNorm && blob.includes(labelNorm)) return true;
  const gcid = name.replace(/^categories\/gcid:/i, "").replace(/_/g, " ");
  if (gcid && blob.includes(normalizeLabel(gcid))) return true;
  return tokens(label).some((t) => blob.includes(t));
}

export type ReconcileAdditionalCategoriesOptions = {
  /**
   * GCIDs seen among Local Pack competitors (fuzzy-matched).
   * When non-empty, AI may drop a current category that is absent here -
   * reconcile will not restore it. Empty / omitted = no competitor-based removals.
   */
  competitorGcids?: ReadonlySet<string> | null;
};

/**
 * Keep current categories unless (a) avoid/outOfScope or
 * (b) competitor stats exist and this GCID was not seen in Local Pack.
 * Always allow adds.
 */
export function reconcileAdditionalCategories(
  current: string[],
  suggested: string[],
  displayByName: Map<string, string>,
  avoidText = "",
  options: ReconcileAdditionalCategoriesOptions = {},
): string[] {
  const suggestedSet = new Set(suggested);
  const competitorGcids = options.competitorGcids;
  const useCompetitorSignal = Boolean(
    competitorGcids && competitorGcids.size > 0,
  );
  const allowedRemovals = new Set<string>();

  for (const rem of current) {
    if (suggestedSet.has(rem)) continue;
    const remLabel = displayByName.get(rem) ?? rem;
    if (isExplicitlyAvoided(remLabel, rem, avoidText)) {
      allowedRemovals.add(rem);
      continue;
    }
    if (useCompetitorSignal && !competitorGcids!.has(rem)) {
      allowedRemovals.add(rem);
    }
  }

  const result: string[] = [];
  for (const name of current) {
    if (allowedRemovals.has(name)) continue;
    result.push(name);
  }
  for (const name of suggested) {
    if (result.includes(name)) continue;
    result.push(name);
  }

  return result.slice(0, 9);
}
