import { and, eq, gt, isNotNull, isNull, sql, type SQL } from "drizzle-orm";
import { db } from "@/lib/db";
import { reviews, type Profile, type Review } from "@/lib/db/schema";
import { DRAFT_STALE_MS } from "@/features/opinie/draft-reviews";
import { PUBLISH_STALE_MS } from "@/features/opinie/publish-reply";
import {
  REVIEWS_PAGE_SIZE,
  type ReviewStatusFilter,
} from "@/features/opinie/review-filters";
import {
  changedAfterReply,
  splitReviewText,
  type RatingFilter,
} from "@/features/opinie/review-rules";

/** A review as the list shows it (plain values - safe to pass to client components). */
export type ReviewItem = {
  id: string;
  rating: number | null;
  authorName: string;
  authorPhotoUrl: string | null;
  /** What the author wrote (null = stars only) */
  original: string | null;
  /** Google's translation, when the review was written in another language */
  translated: string | null;
  createdAt: string | null;
  /** The author changed the review after the reply */
  changedAfterReply: boolean;
  /** 1-2 stars without a reply: the one that needs a quick reaction */
  urgent: boolean;
  replyText: string | null;
  replySource: "panel" | "external" | null;
  repliedAt: string | null;
  draftText: string | null;
  draftStatus: "none" | "generating" | "ready" | "failed";
  publishStatus: "idle" | "publishing" | "failed";
  publishError: string | null;
};

export type ReviewCounts = {
  status: Record<ReviewStatusFilter, number>;
  rating: Record<RatingFilter, number>;
};

function statusWhere(status: ReviewStatusFilter): SQL | undefined {
  if (status === "pending") return isNull(reviews.replyText);
  if (status === "replied") return isNotNull(reviews.replyText);
  return undefined;
}

function ratingWhere(rating: RatingFilter): SQL | undefined {
  if (rating === "low") return sql`${reviews.rating} <= 2`;
  if (rating === "mid") return sql`${reviews.rating} = 3`;
  if (rating === "high") return sql`${reviews.rating} >= 4`;
  return undefined;
}

export function toReviewItem(row: Review, now: Date): ReviewItem {
  const { original, translated } = splitReviewText(row.comment);
  const staleDraft =
    row.draftStatus === "generating" &&
    now.getTime() - row.updatedAt.getTime() > DRAFT_STALE_MS;
  const stalePublish =
    row.publishStatus === "publishing" &&
    now.getTime() - row.updatedAt.getTime() > PUBLISH_STALE_MS;
  return {
    id: row.id,
    rating: row.rating,
    authorName: row.authorName,
    authorPhotoUrl: row.authorPhotoUrl,
    original,
    translated,
    createdAt: row.reviewCreatedAt?.toISOString() ?? null,
    changedAfterReply: changedAfterReply(row),
    urgent: !row.replyText && row.rating !== null && row.rating <= 2,
    replyText: row.replyText,
    replySource: row.replySource,
    repliedAt: row.repliedAt?.toISOString() ?? null,
    draftText: row.draftText,
    // A job that died leaves "generating"/"publishing" behind - show it as failed.
    draftStatus: staleDraft ? "failed" : row.draftStatus,
    publishStatus: stalePublish ? "failed" : row.publishStatus,
    publishError: row.publishError,
  };
}

/** The profile's reviews for the list. Always scoped by the profile id. */
export async function loadReviews(
  profile: Pick<Profile, "id">,
  filter: { status: ReviewStatusFilter; rating: RatingFilter; limit: number },
  now: Date = new Date(),
): Promise<{
  items: ReviewItem[];
  counts: ReviewCounts;
  hasMore: boolean;
  /** All reviews stored for the profile, whatever the filters */
  total: number;
}> {
  const mine = eq(reviews.profileId, profile.id);
  const limit = Math.max(REVIEWS_PAGE_SIZE, filter.limit);

  const rows = await db
    .select()
    .from(reviews)
    .where(and(mine, statusWhere(filter.status), ratingWhere(filter.rating)))
    .orderBy(sql`${reviews.reviewCreatedAt} desc nulls last`)
    .limit(limit + 1);

  // Counters next to the filters: statuses respect the rating filter and vice versa.
  const [statusCounts] = await db
    .select({
      pending:
        sql<number>`count(*) filter (where ${reviews.replyText} is null)`.mapWith(
          Number,
        ),
      replied:
        sql<number>`count(*) filter (where ${reviews.replyText} is not null)`.mapWith(
          Number,
        ),
      all: sql<number>`count(*)`.mapWith(Number),
    })
    .from(reviews)
    .where(and(mine, ratingWhere(filter.rating)));
  const [ratingCounts] = await db
    .select({
      low: sql<number>`count(*) filter (where ${reviews.rating} <= 2)`.mapWith(
        Number,
      ),
      mid: sql<number>`count(*) filter (where ${reviews.rating} = 3)`.mapWith(
        Number,
      ),
      high: sql<number>`count(*) filter (where ${reviews.rating} >= 4)`.mapWith(
        Number,
      ),
      all: sql<number>`count(*)`.mapWith(Number),
    })
    .from(reviews)
    .where(and(mine, statusWhere(filter.status)));

  const [totalRow] = await db
    .select({ value: sql<number>`count(*)`.mapWith(Number) })
    .from(reviews)
    .where(mine);

  return {
    items: rows.slice(0, limit).map((row) => toReviewItem(row, now)),
    hasMore: rows.length > limit,
    total: totalRow?.value ?? 0,
    counts: {
      status: {
        pending: statusCounts?.pending ?? 0,
        replied: statusCounts?.replied ?? 0,
        all: statusCounts?.all ?? 0,
      },
      rating: {
        low: ratingCounts?.low ?? 0,
        mid: ratingCounts?.mid ?? 0,
        high: ratingCounts?.high ?? 0,
        all: ratingCounts?.all ?? 0,
      },
    },
  };
}

/** Reviews still waiting for a reply (badge in the module tabs, Pulpit). */
export async function countPendingReviews(
  profile: Pick<Profile, "id">,
): Promise<number> {
  const [row] = await db
    .select({ value: sql<number>`count(*)`.mapWith(Number) })
    .from(reviews)
    .where(and(eq(reviews.profileId, profile.id), isNull(reviews.replyText)));
  return row?.value ?? 0;
}

/** Drafts being written right now (the list keeps polling while there are any). */
export async function countGeneratingDrafts(
  profile: Pick<Profile, "id">,
  now: Date = new Date(),
): Promise<number> {
  const staleBefore = new Date(now.getTime() - DRAFT_STALE_MS);
  const [row] = await db
    .select({ value: sql<number>`count(*)`.mapWith(Number) })
    .from(reviews)
    .where(
      and(
        eq(reviews.profileId, profile.id),
        eq(reviews.draftStatus, "generating"),
        gt(reviews.updatedAt, staleBefore),
      ),
    );
  return row?.value ?? 0;
}
