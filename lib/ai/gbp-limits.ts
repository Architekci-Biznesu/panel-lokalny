/** Hard limits for Google Business Profile text fields. */
export const GBP_DESCRIPTION_MAX = 750;
export const GBP_SERVICE_NAME_MAX = 140;
export const GBP_SERVICE_DESC_MAX = 250;

/** Trim and soft-clamp to max length (prefer sentence, then word boundary). */
export function clampTextToLimit(text: string, max: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;

  const slice = trimmed.slice(0, max);
  const minKeep = Math.floor(max * 0.55);

  const sentenceEnd = Math.max(
    slice.lastIndexOf(". "),
    slice.lastIndexOf("! "),
    slice.lastIndexOf("? "),
  );
  if (sentenceEnd >= minKeep) {
    return slice.slice(0, sentenceEnd + 1).trim();
  }

  const space = slice.lastIndexOf(" ");
  if (space >= minKeep) {
    return slice.slice(0, space).trim();
  }

  return slice.trim();
}
