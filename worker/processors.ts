import { UnrecoverableError, type Job } from "bullmq";
import type { JobData, MaintenanceJob, QueueName } from "@/lib/queue";
import {
  publishTarget,
  type PublishJobDeps,
} from "@/features/publikacje/publish-job";
import { runContentGeneration } from "@/features/publikacje/generate";
import { runGbpAudit } from "@/features/wizytowka/audit-run";
import { runScan } from "@/features/wizytowka/rank/run-scan";
import { runReviewSync } from "@/features/opinie/run-sync";
import { runGbpSnapshotRefresh } from "@/features/wizytowka/snapshots/refresh";
import { enqueueDueScheduledPosts } from "@/features/maintenance/scheduled-posts";
import { failStaleRuns } from "@/features/maintenance/stale-runs";
import { startDueAutoScans } from "@/features/maintenance/auto-scans";
import { startDueReviewSyncs } from "@/features/maintenance/review-sweep";
import { prefetchSnapshots } from "@/features/maintenance/snapshot-prefetch";

/**
 * Queue -> runner. Runners take ids, load their rows and keep their state in
 * the database (no session, no next/* - see worker/no-session-imports.test.ts).
 */

type Processors = {
  [N in QueueName]: (job: Job<JobData[N]>) => Promise<unknown>;
};

async function maintenance(job: Job<MaintenanceJob>): Promise<unknown> {
  const data = job.data;
  switch (data.task) {
    case "scheduled-posts":
      return { queued: await enqueueDueScheduledPosts() };
    case "stale-runs":
      return failStaleRuns();
    case "auto-scans":
      return startDueAutoScans();
    case "review-sweep":
      return startDueReviewSyncs();
    case "prefetch":
      return prefetchSnapshots(data.kind);
    case "snapshot-refresh":
      await runGbpSnapshotRefresh({
        tokenProfileId: data.tokenProfileId,
        target: data.target,
      });
      return null;
  }
}

/**
 * `publish` queue. A transient Google error puts the target back in `queued`
 * and throws, so BullMQ retries the job after its backoff. A final error
 * fails the job without retries (UnrecoverableError).
 */
export function publishProcessor(deps?: PublishJobDeps) {
  return async (job: Job<JobData["publish"]>) => {
    const result = await publishTarget(
      job.data.targetId,
      { number: job.attemptsMade + 1, max: job.opts.attempts ?? 1 },
      deps,
    );
    if (result.kind === "retry") throw new Error(result.error);
    if (result.kind === "failed") throw new UnrecoverableError(result.error);
    return result;
  };
}

export const processors: Processors = {
  publish: publishProcessor(),
  async "content-generation"(job) {
    await runContentGeneration(job.data.runId);
    return null;
  },
  async "gbp-audit"(job) {
    await runGbpAudit(job.data.runId);
    return null;
  },
  async "rank-scan"(job) {
    await runScan(job.data.scanId);
    return null;
  },
  async reviews(job) {
    await runReviewSync(job.data.runId);
    return null;
  },
  maintenance,
};
