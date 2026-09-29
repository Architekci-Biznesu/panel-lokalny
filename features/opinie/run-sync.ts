import {
  and,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  isNull,
  or,
} from "drizzle-orm";
import {
  profiles,
  reviews,
  reviewSyncRuns,
  type Profile,
  type Review,
} from "@/lib/db/schema";
import type { ChannelReview } from "@/lib/integrations/channel";
import {
  AUTO_DRAFT_WINDOW_DAYS,
  autoReplyDecision,
  reconcileReply,
  splitReviewText,
  wantsAutoDraft,
} from "@/features/opinie/review-rules";
import { reviewDeps, type ReviewDeps } from "@/features/opinie/review-deps";
import {
  claimDrafts,
  writeClaimedDrafts,
} from "@/features/opinie/draft-reviews";
import { publishReviewReply } from "@/features/opinie/publish-reply";

/**
 * Review synchronization as a background job: takes a run id, needs no
 * session and imports nothing from next/*, so Phase 5 can move it to a worker
 * as it is (same pattern as features/wizytowka/rank/run-scan.ts).
 *
 * Note: a review that vanished from Google (deleted by the author or by
 * Google) is NOT removed here - an incremental sync only sees changes. In the
 * MVP that is acceptable.
 */

/** Safety stop for a first import (50 reviews per page). */
export const MAX_SYNC_PAGES = 200;

/** Drafts written per run; the rest is picked up by the next sync (newest first). */
export const MAX_AUTO_DRAFTS_PER_RUN = 40;

/** A review older than the last good sync by this much is certainly already handled. */
const WATERMARK_MARGIN_MS = 5 * 60 * 1000;

type SyncCounts = {
  fetched: number;
  newCount: number;
  averageRating: number | null;
  totalCount: number | null;
};

function toRow(profileId: string, review: ChannelReview, now: Date) {
  const { original, translated } = splitReviewText(review.comment);
  return {
    profileId,
    channel: "gbp" as const,
    externalId: review.externalId,
    rating: review.rating,
    authorName: review.authorName,
    authorPhotoUrl: review.authorPhotoUrl,
    comment: review.comment,
    // The author's own words, when the stored text is Google's translation
    commentOriginal: translated ? original : null,
    reviewCreatedAt: review.createdAt,
    reviewUpdatedAt: review.updatedAt,
    updatedAt: now,
  };
}

/** Fetches pages (newest change first) and stores what is new or changed. */
async function syncPages(
  profile: Profile,
  runId: string,
  deps: ReviewDeps,
): Promise<SyncCounts> {
  const { db } = deps;
  const channel = deps.channelFor(profile);

  // The first sync of a profile reads everything. Later ones stop at the first
  // review that is unchanged AND older than the last good sync - "known" alone
  // is not enough: a run that failed halfway has stored the newest reviews
  // without having reached the older changed ones.
  const [lastDone] = await db
    .select({ startedAt: reviewSyncRuns.startedAt })
    .from(reviewSyncRuns)
    .where(
      and(
        eq(reviewSyncRuns.profileId, profile.id),
        eq(reviewSyncRuns.status, "done"),
      ),
    )
    .orderBy(desc(reviewSyncRuns.startedAt))
    .limit(1);
  const watermark = lastDone
    ? new Date(lastDone.startedAt.getTime() - WATERMARK_MARGIN_MS)
    : null;

  const counts: SyncCounts = {
    fetched: 0,
    newCount: 0,
    averageRating: null,
    totalCount: null,
  };
  let pageToken: string | null = null;
  let pages = 0;
  let reachedKnown = false;

  do {
    const page = await channel.fetchReviews(pageToken);
    pages++;
    if (pages === 1) {
      counts.averageRating = page.averageRating;
      counts.totalCount = page.totalCount;
    }
    counts.fetched += page.reviews.length;

    const ids = page.reviews.map((review) => review.externalId);
    const existingRows: Review[] = ids.length
      ? await db
          .select()
          .from(reviews)
          .where(
            and(
              eq(reviews.profileId, profile.id),
              eq(reviews.channel, "gbp"),
              inArray(reviews.externalId, ids),
            ),
          )
      : [];
    const existing = new Map(existingRows.map((row) => [row.externalId, row]));

    for (const review of page.reviews) {
      const row = existing.get(review.externalId);
      const now = deps.now();

      const unchanged =
        row?.reviewUpdatedAt != null &&
        review.updatedAt != null &&
        row.reviewUpdatedAt.getTime() >= review.updatedAt.getTime();
      if (unchanged) {
        if (watermark && review.updatedAt && review.updatedAt < watermark) {
          reachedKnown = true;
          break;
        }
        continue;
      }

      const patch = reconcileReply(
        row
          ? {
              replyText: row.replyText,
              replySource: row.replySource,
              repliedAt: row.repliedAt,
            }
          : null,
        review.reply,
        review.updatedAt ?? now,
      );
      const replyColumns = {
        replyText: patch.replyText,
        replySource: patch.replySource,
        repliedAt: patch.repliedAt,
        ...(patch.clearDraft
          ? {
              draftText: null,
              draftStatus: "none" as const,
              publishStatus: "idle" as const,
              publishError: null,
            }
          : {}),
      };

      if (!row) {
        await db
          .insert(reviews)
          .values({
            ...toRow(profile.id, review, now),
            ...replyColumns,
            firstSeenAt: now,
          })
          .onConflictDoNothing();
        counts.newCount++;
      } else {
        await db
          .update(reviews)
          .set({ ...toRow(profile.id, review, now), ...replyColumns })
          .where(
            and(eq(reviews.id, row.id), eq(reviews.profileId, profile.id)),
          );
      }
    }

    pageToken = reachedKnown ? null : page.nextPageToken;
  } while (pageToken && pages < MAX_SYNC_PAGES);

  // One line per sync: how many pages Google was asked for (an incremental sync
  // without news reads exactly one).
  console.info(
    `[reviews] sync ${profile.id}: ${pages} page(s), ${counts.fetched} fetched, ${counts.newCount} new`,
  );

  await db
    .update(reviewSyncRuns)
    .set({
      fetched: counts.fetched,
      newCount: counts.newCount,
      averageRating:
        counts.averageRating != null ? counts.averageRating.toFixed(2) : null,
      totalCount: counts.totalCount,
    })
    .where(eq(reviewSyncRuns.id, runId));

  return counts;
}

/** Drafts for unanswered reviews from the last 30 days - older ones only on request. */
async function draftNewReviews(profile: Profile, deps: ReviewDeps) {
  const now = deps.now();
  const windowStart = new Date(
    now.getTime() - AUTO_DRAFT_WINDOW_DAYS * 86_400_000,
  );

  const candidates = await deps.db
    .select({
      id: reviews.id,
      replyText: reviews.replyText,
      reviewCreatedAt: reviews.reviewCreatedAt,
      firstSeenAt: reviews.firstSeenAt,
    })
    .from(reviews)
    .where(
      and(
        eq(reviews.profileId, profile.id),
        isNull(reviews.replyText),
        eq(reviews.draftStatus, "none"),
        or(
          isNull(reviews.reviewCreatedAt),
          gte(reviews.reviewCreatedAt, windowStart),
        ),
      ),
    )
    .orderBy(desc(reviews.reviewCreatedAt))
    .limit(MAX_AUTO_DRAFTS_PER_RUN * 2);

  const ids = candidates
    .filter((review) => wantsAutoDraft(review, now))
    .slice(0, MAX_AUTO_DRAFTS_PER_RUN)
    .map((review) => review.id);

  const claimed = await claimDrafts(ids, profile.id, deps);
  return writeClaimedDrafts(claimed, profile, deps);
}

/**
 * Automatic mode: publishes ready drafts through the SAME function as the
 * customer's "Opublikuj". The rules live in autoReplyDecision (1-2 stars and
 * reviews from before the switch are excluded first); the query narrows the
 * candidates, the decision has the last word.
 */
async function publishAutoReplies(profile: Profile, deps: ReviewDeps) {
  if (profile.reviewMode !== "auto" || !profile.reviewAutoSince) return 0;

  const candidates = await deps.db
    .select()
    .from(reviews)
    .where(
      and(
        eq(reviews.profileId, profile.id),
        isNull(reviews.replyText),
        eq(reviews.draftStatus, "ready"),
        isNotNull(reviews.draftText),
        eq(reviews.publishStatus, "idle"),
        gte(reviews.firstSeenAt, profile.reviewAutoSince),
      ),
    );

  let published = 0;
  for (const review of candidates) {
    const decision = autoReplyDecision({
      rating: review.rating,
      mode: profile.reviewMode,
      autoSince: profile.reviewAutoSince,
      firstSeenAt: review.firstSeenAt,
      reviewCreatedAt: review.reviewCreatedAt,
      hasReply: Boolean(review.replyText),
    });
    if (!decision.publish) continue;
    const result = await publishReviewReply(
      { reviewId: review.id, profileId: profile.id },
      deps,
    );
    if (result.ok) published++;
  }
  return published;
}

async function finishRun(
  runId: string,
  deps: ReviewDeps,
  outcome: { status: "done" } | { status: "failed"; error: string },
) {
  await deps.db
    .update(reviewSyncRuns)
    .set({
      status: outcome.status,
      error: outcome.status === "failed" ? outcome.error : null,
      finishedAt: deps.now(),
    })
    .where(eq(reviewSyncRuns.id, runId));
}

// TODO: przenieść do kolejki BullMQ + synchronizacja cykliczna (Faza 5)
export async function runReviewSync(
  runId: string,
  deps: ReviewDeps = reviewDeps(),
): Promise<void> {
  const [run] = await deps.db
    .select()
    .from(reviewSyncRuns)
    .where(eq(reviewSyncRuns.id, runId))
    .limit(1);
  if (!run || run.status !== "running") return;

  try {
    // The run row was created after the caller verified the profile.
    const [profile] = await deps.db
      .select()
      .from(profiles)
      .where(eq(profiles.id, run.profileId))
      .limit(1);
    if (!profile) throw new Error("Profil nie istnieje");

    await syncPages(profile, run.id, deps);
    await draftNewReviews(profile, deps);
    await publishAutoReplies(profile, deps);
    await finishRun(run.id, deps, { status: "done" });
  } catch (error) {
    console.error("Review sync failed:", error);
    const message =
      error instanceof Error && error.name === "ChannelReviewError"
        ? error.message
        : "Nie udało się sprawdzić opinii w Google";
    await finishRun(run.id, deps, { status: "failed", error: message });
  }
}
