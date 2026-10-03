import { and, isNotNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { profiles, reviewSyncRuns } from "@/lib/db/schema";
import {
  REVIEW_SYNC_AUTO_EVERY_MS,
  REVIEW_SYNC_OTHER_EVERY_MS,
} from "@/lib/config/job-limits";
import { enqueueReviewSync } from "@/lib/queue";
import {
  failReviewSync,
  startReviewSync,
} from "@/features/opinie/sync-control";

/** A run that ended a little earlier than the full interval still counts (the job itself runs every 30 min). */
const MARGIN_MS = 5 * 60 * 1000;

/**
 * Every 30 minutes: review sync without opening the panel. Profiles in auto
 * mode every time (replies go out on their own), the other connected ones
 * every REVIEW_SYNC_OTHER_EVERY_MS. Auto-mode rules (1-2 stars, reviews
 * before the mode was switched on) live in runReviewSync - same code as a
 * sync started from /opinie.
 */
export async function startDueReviewSyncs(now: Date = new Date()) {
  const connected = await db
    .select({
      id: profiles.id,
      reviewMode: profiles.reviewMode,
      lastFinished: sql<Date | null>`(
        select max(${reviewSyncRuns.finishedAt}) from ${reviewSyncRuns}
        where ${reviewSyncRuns.profileId} = ${profiles.id}
      )`,
    })
    .from(profiles)
    .where(
      and(
        isNotNull(profiles.gbpLocationId),
        isNotNull(profiles.oauthConnectionId),
      ),
    );

  let started = 0;
  for (const profile of connected) {
    const every =
      profile.reviewMode === "auto"
        ? REVIEW_SYNC_AUTO_EVERY_MS
        : REVIEW_SYNC_OTHER_EVERY_MS;
    const last = profile.lastFinished
      ? new Date(profile.lastFinished).getTime()
      : 0;
    if (now.getTime() - last < every - MARGIN_MS) continue;

    const run = await startReviewSync(profile.id);
    if (!run.started) continue;
    try {
      await enqueueReviewSync(run.runId);
      started += 1;
    } catch (error) {
      await failReviewSync(
        run.runId,
        "Nie udało się zlecić sprawdzenia opinii",
      );
      throw error;
    }
  }
  return { started };
}
