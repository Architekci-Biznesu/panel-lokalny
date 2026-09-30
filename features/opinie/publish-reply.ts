import { and, eq, lt, or, sql } from "drizzle-orm";
import { profiles, reviews, type Profile, type Review } from "@/lib/db/schema";
import { ChannelReviewError } from "@/lib/integrations/channel";
import { checkReplyText } from "@/features/opinie/review-rules";
import { reviewDeps, type ReviewDeps } from "@/features/opinie/review-deps";

/** A publish `publishing` for longer than this is treated as abandoned and may be retried. */
export const PUBLISH_STALE_MS = 5 * 60 * 1000;

export type ReplyResult = { ok: true } | { ok: false; error: string };

const PUBLISH_FAILED = "Nie udało się opublikować odpowiedzi w Google";

async function loadReview(
  reviewId: string,
  profileId: string,
  deps: ReviewDeps,
): Promise<{ review: Review; profile: Profile } | null> {
  const [row] = await deps.db
    .select({ review: reviews, profile: profiles })
    .from(reviews)
    .innerJoin(profiles, eq(profiles.id, reviews.profileId))
    // Scoped in the query: a review of another profile is simply not found.
    .where(and(eq(reviews.id, reviewId), eq(reviews.profileId, profileId)))
    .limit(1);
  return row ?? null;
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ChannelReviewError ? error.message : fallback;
}

/**
 * Publishes the saved draft as the reply. The ONE path for both the customer's
 * "Opublikuj" click and automatic mode - same claim, same status and error
 * bookkeeping. Publishing again replaces the reply in Google (PUT is
 * idempotent), so a retry can never leave two replies.
 */
export async function publishReviewReply(
  input: { reviewId: string; profileId: string },
  deps: ReviewDeps = reviewDeps(),
): Promise<ReplyResult> {
  const found = await loadReview(input.reviewId, input.profileId, deps);
  if (!found) return { ok: false, error: "Nie znaleziono opinii" };
  const { review, profile } = found;

  const checked = checkReplyText(review.draftText ?? "");
  if (!checked.ok) return checked;

  // One publish at a time per review (a double click, or the sync at the same moment).
  const staleBefore = new Date(deps.now().getTime() - PUBLISH_STALE_MS);
  const [claimed] = await deps.db
    .update(reviews)
    .set({
      publishStatus: "publishing",
      publishError: null,
      updatedAt: deps.now(),
    })
    .where(
      and(
        eq(reviews.id, review.id),
        eq(reviews.profileId, profile.id),
        or(
          sql`${reviews.publishStatus} <> 'publishing'`,
          lt(reviews.updatedAt, staleBefore),
        ),
      ),
    )
    .returning({ id: reviews.id });
  if (!claimed)
    return { ok: false, error: "Odpowiedź jest właśnie publikowana" };

  try {
    const { repliedAt } = await deps
      .channelFor(profile)
      .replyToReview(review.externalId, checked.text);
    await deps.db
      .update(reviews)
      .set({
        replyText: checked.text,
        replySource: "panel",
        repliedAt: repliedAt ?? deps.now(),
        draftText: null,
        draftStatus: "none",
        draftEditedAt: null,
        draftOutdatedAt: null,
        publishStatus: "idle",
        publishError: null,
        updatedAt: deps.now(),
      })
      .where(and(eq(reviews.id, review.id), eq(reviews.profileId, profile.id)));
    return { ok: true };
  } catch (error) {
    const message = errorMessage(error, PUBLISH_FAILED);
    if (!(error instanceof ChannelReviewError)) {
      console.error("Review reply publish failed:", error);
    }
    await deps.db
      .update(reviews)
      .set({
        publishStatus: "failed",
        publishError: message,
        updatedAt: deps.now(),
      })
      .where(and(eq(reviews.id, review.id), eq(reviews.profileId, profile.id)));
    return { ok: false, error: message };
  }
}

/** "Usuń odpowiedź": removes the public reply; the review goes back to "Do odpowiedzi". */
export async function deleteReviewReply(
  input: { reviewId: string; profileId: string },
  deps: ReviewDeps = reviewDeps(),
): Promise<ReplyResult> {
  const found = await loadReview(input.reviewId, input.profileId, deps);
  if (!found) return { ok: false, error: "Nie znaleziono opinii" };
  const { review, profile } = found;
  if (!review.replyText)
    return { ok: false, error: "Ta opinia nie ma odpowiedzi" };

  try {
    await deps.channelFor(profile).deleteReply(review.externalId);
  } catch (error) {
    if (!(error instanceof ChannelReviewError)) {
      console.error("Review reply delete failed:", error);
    }
    return {
      ok: false,
      error: errorMessage(error, "Nie udało się usunąć odpowiedzi w Google"),
    };
  }

  await deps.db
    .update(reviews)
    .set({
      replyText: null,
      replySource: null,
      repliedAt: null,
      draftText: null,
      draftStatus: "none",
      draftEditedAt: null,
      draftOutdatedAt: null,
      publishStatus: "idle",
      publishError: null,
      updatedAt: deps.now(),
    })
    .where(and(eq(reviews.id, review.id), eq(reviews.profileId, profile.id)));
  return { ok: true };
}
