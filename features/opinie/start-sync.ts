import { after } from "next/server";
import type { Profile } from "@/lib/db/schema";
import { runReviewSync } from "@/features/opinie/run-sync";
import {
  isReviewSyncDue,
  startReviewSync,
} from "@/features/opinie/sync-control";

/**
 * The only place that ties the sync job to Next: `after()` runs it once the
 * response is sent. Callers must have verified the profile (getActiveProfile).
 */
export async function beginReviewSync(
  profile: Pick<Profile, "id">,
): Promise<{ runId: string; started: boolean }> {
  const run = await startReviewSync(profile.id);
  if (run.started) {
    // TODO: przenieść do kolejki BullMQ + synchronizacja cykliczna (Faza 5)
    after(() => {
      void runReviewSync(run.runId);
    });
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
