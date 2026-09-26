/**
 * Hard ban patterns for GBP description - ratings / reviews filling.
 * Used after the model returns text (prompt alone is not enough).
 */
const REVIEW_FLUFF =
  /\b(opini[aąęi]|recenzj\w*|ocen\w*|gwiazd\w*|reviews?|ratings?|★|⭐)\b|\d([.,]\d)?\s*\/\s*5|\d([.,]\d)?\s*na\s*5/i;

export function descriptionMentionsReviews(text: string): boolean {
  return REVIEW_FLUFF.test(text);
}

/** Drop whole sentences that talk about reviews / ratings / stars. */
export function stripReviewFluffFromDescription(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "";

  const parts = trimmed.split(/(?<=[.!?…])\s+/u);
  const kept = parts.filter((part) => !REVIEW_FLUFF.test(part));
  return kept
    .join(" ")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim();
}
