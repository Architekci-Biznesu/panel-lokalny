/** Pure rules for the customer's per-rating reply guidelines (no DB, safe for client and tests). */

export const RATING_KEYS = ["1", "2", "3", "4", "5"] as const;
export type RatingKey = (typeof RATING_KEYS)[number];

/** Guidelines the customer wrote for each star rating; a missing key = none. */
export type RatingInstructions = Partial<Record<RatingKey, string>>;

/** One rating's guidelines, at most this many characters. */
export const RATING_INSTRUCTION_MAX = 800;

/**
 * Keeps only ratings 1-5 with non-empty text (trimmed). Null when nothing is
 * left, so the column stays empty instead of holding `{}`.
 */
export function normalizeRatingInstructions(
  value: unknown,
): RatingInstructions | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  const result: RatingInstructions = {};
  for (const key of RATING_KEYS) {
    const text = source[key];
    if (typeof text !== "string") continue;
    const trimmed = text.trim().slice(0, RATING_INSTRUCTION_MAX);
    if (trimmed) result[key] = trimmed;
  }
  return Object.keys(result).length > 0 ? result : null;
}

/** Guidelines for one review's rating; null for a review without a usable rating. */
export function pickRatingInstructions(
  instructions: RatingInstructions | null | undefined,
  rating: number | null,
): string | null {
  if (!instructions || rating === null) return null;
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return null;
  return instructions[String(rating) as RatingKey]?.trim() || null;
}

export type ReplyPerspective = "team" | "owner";
export type ReplyStyle = "warm" | "formal";

export const REPLY_PERSPECTIVES: Array<{
  value: ReplyPerspective;
  label: string;
}> = [
  { value: "team", label: "Zespół (Dziękujemy)" },
  { value: "owner", label: "Właściciel (Dziękuję)" },
];

export const REPLY_STYLES: Array<{ value: ReplyStyle; label: string }> = [
  { value: "warm", label: "Ciepły i bezpośredni" },
  { value: "formal", label: "Formalny" },
];
