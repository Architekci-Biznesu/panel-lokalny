import { and, eq, lt } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  contentGenerationRuns,
  contentTargets,
  gbpAuditRuns,
  rankScans,
  reviewSyncRuns,
} from "@/lib/db/schema";
import {
  CONTENT_GENERATION_STALE_MS,
  GBP_AUDIT_STALE_MS,
  PUBLISH_TARGET_STALE_MS,
} from "@/lib/config/job-limits";
import { RANK_STALE_RUNNING_MS } from "@/lib/config/rank-limits";
import { PUBLISH_UNKNOWN_OUTCOME_MESSAGE } from "@/lib/integrations/channel";
import { SYNC_STALE_MS } from "@/features/opinie/review-rules";

export const INTERRUPTED_MESSAGE =
  "Zadanie zostało przerwane - spróbuj ponownie";

function before(now: Date, ms: number): Date {
  return new Date(now.getTime() - ms);
}

/**
 * Every 5 minutes: work cut off by a restart (the worker died, a deploy)
 * would stay `running` forever and the UI would poll without end. Runs older
 * than their limit become `failed`. A post target stuck in `publishing` may
 * already exist in Google - failed with the "unknown result" message, never
 * retried automatically.
 */
export async function failStaleRuns(now: Date = new Date()) {
  const finished = { status: "failed" as const, finishedAt: now };

  const generation = await db
    .update(contentGenerationRuns)
    .set({ ...finished, error: INTERRUPTED_MESSAGE })
    .where(
      and(
        eq(contentGenerationRuns.status, "running"),
        lt(
          contentGenerationRuns.startedAt,
          before(now, CONTENT_GENERATION_STALE_MS),
        ),
      ),
    )
    .returning({ id: contentGenerationRuns.id });

  const audits = await db
    .update(gbpAuditRuns)
    .set({ ...finished, error: INTERRUPTED_MESSAGE })
    .where(
      and(
        eq(gbpAuditRuns.status, "running"),
        lt(gbpAuditRuns.startedAt, before(now, GBP_AUDIT_STALE_MS)),
      ),
    )
    .returning({ id: gbpAuditRuns.id });

  const scans = await db
    .update(rankScans)
    .set({ ...finished, error: INTERRUPTED_MESSAGE })
    .where(
      and(
        eq(rankScans.status, "running"),
        lt(rankScans.startedAt, before(now, RANK_STALE_RUNNING_MS)),
      ),
    )
    .returning({ id: rankScans.id });

  const reviewSyncs = await db
    .update(reviewSyncRuns)
    .set({ ...finished, error: "Sprawdzanie opinii zostało przerwane" })
    .where(
      and(
        eq(reviewSyncRuns.status, "running"),
        lt(reviewSyncRuns.progressAt, before(now, SYNC_STALE_MS)),
      ),
    )
    .returning({ id: reviewSyncRuns.id });

  const publishing = await db
    .update(contentTargets)
    .set({
      status: "failed",
      error: PUBLISH_UNKNOWN_OUTCOME_MESSAGE,
      claimedAt: null,
    })
    .where(
      and(
        eq(contentTargets.status, "publishing"),
        lt(contentTargets.claimedAt, before(now, PUBLISH_TARGET_STALE_MS)),
      ),
    )
    .returning({ id: contentTargets.id });

  return {
    generation: generation.length,
    audits: audits.length,
    scans: scans.length,
    reviewSyncs: reviewSyncs.length,
    publishing: publishing.length,
  };
}
