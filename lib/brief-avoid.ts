/** Adds a rejection reason as a new line of `avoid` (skips an exact repeat). */
export function mergeAvoid(
  existing: string | null | undefined,
  reason: string,
): string {
  const lines = (existing ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const next = reason.trim();
  if (
    next &&
    !lines.some((line) => line.toLowerCase() === next.toLowerCase())
  ) {
    lines.push(next);
  }
  return lines.join("\n");
}
