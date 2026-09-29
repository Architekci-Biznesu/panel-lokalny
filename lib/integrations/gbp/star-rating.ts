const STAR_RATINGS: Record<string, number> = {
  ONE: 1,
  TWO: 2,
  THREE: 3,
  FOUR: 4,
  FIVE: 5,
};

/** Google `starRating` enum -> 1-5 (the only place that maps it); null for STAR_RATING_UNSPECIFIED or anything else. */
export function starRatingToNumber(value: unknown): number | null {
  return typeof value === "string" ? (STAR_RATINGS[value] ?? null) : null;
}
