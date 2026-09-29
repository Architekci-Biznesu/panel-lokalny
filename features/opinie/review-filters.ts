import type { RatingFilter } from "@/features/opinie/review-rules";

/** Do odpowiedzi (no public reply yet) / Z odpowiedzią / Wszystkie. */
export type ReviewStatusFilter = "pending" | "all" | "replied";

export const REVIEW_STATUS_FILTERS: Array<{
  value: ReviewStatusFilter;
  label: string;
}> = [
  { value: "pending", label: "Do odpowiedzi" },
  { value: "replied", label: "Z odpowiedzią" },
  { value: "all", label: "Wszystkie" },
];

export const REVIEW_RATING_FILTERS: Array<{
  value: RatingFilter;
  label: string;
}> = [
  { value: "all", label: "Wszystkie oceny" },
  { value: "low", label: "1-2" },
  { value: "mid", label: "3" },
  { value: "high", label: "4-5" },
];

export function parseReviewStatus(
  value: string | undefined,
): ReviewStatusFilter {
  return REVIEW_STATUS_FILTERS.some((filter) => filter.value === value)
    ? (value as ReviewStatusFilter)
    : "pending";
}

export function parseReviewRating(value: string | undefined): RatingFilter {
  return REVIEW_RATING_FILTERS.some((filter) => filter.value === value)
    ? (value as RatingFilter)
    : "all";
}

/** Reviews shown at once; "Pokaż więcej" adds another page. */
export const REVIEWS_PAGE_SIZE = 30;
