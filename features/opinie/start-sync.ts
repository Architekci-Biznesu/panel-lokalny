import type { Profile } from "@/lib/db/schema";
import { enqueueReviewSync } from "@/lib/queue";
import {
  failReviewSync,
  isReviewSyncDue,
  startReviewSync,
} from "@/features/opinie/sync-control";

/**
 * Starts a review sync in the worker (`runReviewSync`, queue `reviews`).
 * Callers must have verified the profile (getActiveProfile) - the worker's
 * cyclic sync (features/maintenance) starts runs without a session.
 */
export async function beginReviewSync(
  profile: Pick<Profile, "id">,
): Promise<{ runId: string; started: boolean }> {
  const run = await startReviewSync(profile.id);
  if (run.started) {
    try {
      await enqueueReviewSync(run.runId);
    } catch (error) {
      await failReviewSync(
        run.runId,
        "Nie udało się zlecić sprawdzenia opinii",
      );
      throw error;
    }
  }
  return run;
}

/** Opening /opinie: sync when the last check is older than 15 minutes. Never breaks the page. */
export async function ensureFreshReviewSync(
  profile: Pick<Profile, "id" | "gbpLocationId" | "oauthConnectionId">,
): Promise<void> {
  if (!profile.gbpLocationId || !profile.oauthConnectionId) return;
  try {
    if (await isReviewSyncDue(profile.id)) await beginReviewSync(profile);
  } catch (error) {
    console.error("Review sync could not start:", error);
  }
}
