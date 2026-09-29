import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { reviews, type Profile } from "@/lib/db/schema";

export type PulpitReview = {
  id: string;
  authorName: string;
  rating: number | null;
  createdAt: string | null;
};

export type PulpitReviews = {
  /** Reviews without a reply */
  pending: number;
  /** Reviews written in the last 7 days */
  lastWeek: number;
  items: PulpitReview[];
};

const PREVIEW = 4;

/** "Nowe opinie" on the dashboard: the newest ones still waiting for a reply. */
export async function loadPulpitReviews(
  profile: Pick<Profile, "id">,
  now: Date = new Date(),
): Promise<PulpitReviews> {
  const mine = eq(reviews.profileId, profile.id);
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000);

  const [counts] = await db
    .select({
      pending:
        sql<number>`count(*) filter (where ${reviews.replyText} is null)`.mapWith(
          Number,
        ),
      lastWeek:
        sql<number>`count(*) filter (where ${reviews.reviewCreatedAt} >= ${weekAgo.toISOString()}::timestamptz)`.mapWith(
          Number,
        ),
    })
    .from(reviews)
    .where(mine);

  const rows = await db
    .select({
      id: reviews.id,
      authorName: reviews.authorName,
      rating: reviews.rating,
      reviewCreatedAt: reviews.reviewCreatedAt,
    })
    .from(reviews)
    .where(and(mine, isNull(reviews.replyText)))
    .orderBy(desc(reviews.reviewCreatedAt))
    .limit(PREVIEW);

  return {
    pending: counts?.pending ?? 0,
    lastWeek: counts?.lastWeek ?? 0,
    items: rows.map((row) => ({
      id: row.id,
      authorName: row.authorName,
      rating: row.rating,
      createdAt: row.reviewCreatedAt?.toISOString() ?? null,
    })),
  };
}
