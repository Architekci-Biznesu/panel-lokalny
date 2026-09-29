import { and, eq, inArray, lt, or, sql } from "drizzle-orm";
import { mapPool } from "@/lib/async-pool";
import { profiles, reviews, type Profile, type Review } from "@/lib/db/schema";
import {
  checkReplyText,
  splitReviewText,
} from "@/features/opinie/review-rules";
import { pickRatingInstructions } from "@/features/opinie/review-settings";
import { reviewDeps, type ReviewDeps } from "@/features/opinie/review-deps";
import {
  loadReplyContext,
  type ReplyContext,
} from "@/features/opinie/reply-context";

/** Drafts written at once (each is one AI call). */
export const DRAFT_CONCURRENCY = 3;

/** A draft `generating` for longer than this is treated as failed. */
export const DRAFT_STALE_MS = 5 * 60 * 1000;

export type DraftResult =
  { ok: true; text: string } | { ok: false; error: string };

const DRAFT_FAILED = "AI nie zdołało napisać odpowiedzi - spróbuj ponownie";

/** Calls the AI for one review and stores the result; the row is already claimed. */
async function writeDraft(
  review: Review,
  profile: Profile,
  context: ReplyContext,
  oneOffInstruction: string | null,
  deps: ReviewDeps,
): Promise<DraftResult> {
  const { original, translated } = splitReviewText(review.comment);
  let error = DRAFT_FAILED;
  try {
    const text = await deps.generateReply({
      businessName: context.businessName,
      brief: context.brief,
      avoid: context.avoid,
      rating: review.rating,
      authorName: review.authorName,
      reviewText: original,
      translatedText: translated,
      instructions: context.instructions,
      ratingInstructions: pickRatingInstructions(
        context.ratingInstructions,
        review.rating,
      ),
      signature: context.signature,
      phone: context.phone,
      perspective: context.perspective,
      style: context.style,
      oneOffInstruction,
    });
    const checked = checkReplyText(text);
    if (checked.ok) {
      await deps.db
        .update(reviews)
        .set({
          draftText: checked.text,
          draftStatus: "ready",
          updatedAt: deps.now(),
        })
        .where(
          and(eq(reviews.id, review.id), eq(reviews.profileId, profile.id)),
        );
      return { ok: true, text: checked.text };
    }
    error = checked.error;
  } catch (cause) {
    console.error("Review draft failed:", cause);
  }
  await deps.db
    .update(reviews)
    .set({ draftStatus: "failed", updatedAt: deps.now() })
    .where(and(eq(reviews.id, review.id), eq(reviews.profileId, profile.id)));
  return { ok: false, error };
}

async function loadReviewWithProfile(
  reviewId: string,
  profileId: string,
  deps: ReviewDeps,
): Promise<{ review: Review; profile: Profile } | null> {
  const [row] = await deps.db
    .select({ review: reviews, profile: profiles })
    .from(reviews)
    .innerJoin(profiles, eq(profiles.id, reviews.profileId))
    // Scoped in the query: another profile's review is simply not found.
    .where(and(eq(reviews.id, reviewId), eq(reviews.profileId, profileId)))
    .limit(1);
  return row ?? null;
}

/**
 * "Zaproponuj odpowiedź" / "Wygeneruj ponownie": one draft for an unanswered
 * review, optionally following a one-off instruction from the customer.
 */
export async function generateReviewDraft(
  input: {
    reviewId: string;
    profileId: string;
    oneOffInstruction?: string | null;
  },
  deps: ReviewDeps = reviewDeps(),
): Promise<DraftResult> {
  const found = await loadReviewWithProfile(
    input.reviewId,
    input.profileId,
    deps,
  );
  if (!found) return { ok: false, error: "Nie znaleziono opinii" };
  const { review, profile } = found;

  // AI never proposes a reply for a review that already has one.
  if (review.replyText) {
    return { ok: false, error: "Ta opinia ma już odpowiedź" };
  }

  const staleBefore = new Date(deps.now().getTime() - DRAFT_STALE_MS);
  const [claimed] = await deps.db
    .update(reviews)
    .set({ draftStatus: "generating", updatedAt: deps.now() })
    .where(
      and(
        eq(reviews.id, review.id),
        eq(reviews.profileId, profile.id),
        or(
          sql`${reviews.draftStatus} <> 'generating'`,
          lt(reviews.updatedAt, staleBefore),
        ),
      ),
    )
    .returning({ id: reviews.id });
  if (!claimed) return { ok: false, error: "Szkic jest już generowany" };

  const context = await loadReplyContext(profile, deps);
  return writeDraft(
    review,
    profile,
    context,
    input.oneOffInstruction?.trim() || null,
    deps,
  );
}

/**
 * Drafts for many reviews of one profile in a background run (limited
 * parallelism). The rows must already be `generating` (claimed by the caller),
 * so the list shows skeletons while they are written.
 */
export async function writeClaimedDrafts(
  reviewIds: string[],
  profile: Profile,
  deps: ReviewDeps = reviewDeps(),
): Promise<{ written: number; failed: number }> {
  if (reviewIds.length === 0) return { written: 0, failed: 0 };

  const rows = await deps.db
    .select()
    .from(reviews)
    .where(
      and(eq(reviews.profileId, profile.id), inArray(reviews.id, reviewIds)),
    );
  const context = await loadReplyContext(profile, deps);

  const results = await mapPool(rows, DRAFT_CONCURRENCY, (review) =>
    writeDraft(review, profile, context, null, deps),
  );
  const written = results.filter((result) => result.ok).length;
  return { written, failed: results.length - written };
}

/** Marks rows `generating` and returns the ids this call got (others are taken). */
export async function claimDrafts(
  reviewIds: string[],
  profileId: string,
  deps: ReviewDeps = reviewDeps(),
): Promise<string[]> {
  if (reviewIds.length === 0) return [];
  const claimed = await deps.db
    .update(reviews)
    .set({ draftStatus: "generating", updatedAt: deps.now() })
    .where(
      and(
        eq(reviews.profileId, profileId),
        inArray(reviews.id, reviewIds),
        eq(reviews.draftStatus, "none"),
      ),
    )
    .returning({ id: reviews.id });
  return claimed.map((row) => row.id);
}
