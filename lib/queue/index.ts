import { Queue, type JobsOptions } from "bullmq";
import { appConnection } from "@/lib/queue/connection";
import {
  JOB_KEEP_SECONDS,
  PUBLISH_ATTEMPTS,
  PUBLISH_BACKOFF_MS,
} from "@/lib/config/job-limits";
import type { SnapshotTarget } from "@/lib/integrations/gbp/snapshots/store";

/**
 * The only place that knows BullMQ queues. The rest of the app calls the
 * `enqueue...()` functions below, never `new Queue()` (same rule as lib/ai
 * and lib/storage). No session, no next/* - the worker imports it too.
 *
 * Jobs carry ids only. The database is the source of truth: every runner
 * loads its row and checks its status before doing anything.
 */

export const QUEUE_NAMES = [
  "publish",
  "content-generation",
  "gbp-audit",
  "rank-scan",
  "reviews",
  "maintenance",
] as const;

export type QueueName = (typeof QUEUE_NAMES)[number];

/** Data of each queue's jobs. */
export type JobData = {
  publish: { targetId: string };
  "content-generation": { runId: string };
  "gbp-audit": { runId: string };
  "rank-scan": { scanId: string };
  reviews: { runId: string };
  maintenance: MaintenanceJob;
};

/** Cyclic and housekeeping work (worker/schedules.ts) plus snapshot refreshes. */
export type MaintenanceJob =
  | { task: "scheduled-posts" }
  | { task: "stale-runs" }
  | { task: "auto-scans" }
  | { task: "review-sweep" }
  | { task: "prefetch"; kind: "location" | "media" | "metrics" }
  | {
      task: "snapshot-refresh";
      tokenProfileId: string;
      target: SnapshotTarget;
    };

const keep = { age: JOB_KEEP_SECONDS };

/** Default options per queue (job history kept for Bull Board). */
export const QUEUE_JOB_OPTIONS: Record<QueueName, JobsOptions> = {
  // Retries only for transient Google errors - the runner decides
  // (features/publikacje/publish-job.ts); a duplicate post is impossible
  // because the target is claimed in the database, not because of the job id.
  publish: {
    attempts: PUBLISH_ATTEMPTS,
    backoff: { type: "exponential", delay: PUBLISH_BACKOFF_MS },
    removeOnComplete: keep,
    removeOnFail: keep,
  },
  // Runners keep their own state in the database; a failed run is not retried.
  "content-generation": {
    attempts: 1,
    removeOnComplete: keep,
    removeOnFail: keep,
  },
  "gbp-audit": { attempts: 1, removeOnComplete: keep, removeOnFail: keep },
  "rank-scan": { attempts: 1, removeOnComplete: keep, removeOnFail: keep },
  // Sync and reply publishing are safe to repeat (PUT .../reply overwrites).
  reviews: {
    attempts: 1,
    removeOnComplete: keep,
    removeOnFail: keep,
  },
  maintenance: {
    attempts: 1,
    removeOnComplete: { age: 24 * 60 * 60, count: 1000 },
    removeOnFail: keep,
  },
};

const globalStore = globalThis as typeof globalThis & {
  __panelQueues?: Map<QueueName, Queue>;
};
const queues = (globalStore.__panelQueues ??= new Map());

export function getQueue<N extends QueueName>(name: N): Queue<JobData[N]> {
  let queue = queues.get(name);
  if (!queue) {
    queue = new Queue(name, {
      connection: appConnection(),
      defaultJobOptions: QUEUE_JOB_OPTIONS[name],
    });
    // Without a listener an unreachable Redis crashes the process.
    queue.on("error", (error: Error) =>
      console.error(`[queue] ${name}: ${error.message}`),
    );
    queues.set(name, queue);
  }
  return queue as Queue<JobData[N]>;
}

/** Redis that does not answer must not hang a server action. */
const ENQUEUE_TIMEOUT_MS = 5000;

export class QueueUnavailableError extends Error {
  constructor() {
    super("Kolejka zadań jest niedostępna - spróbuj ponownie za chwilę");
    this.name = "QueueUnavailableError";
  }
}

async function add<N extends QueueName>(
  name: N,
  jobName: string,
  data: JobData[N],
  opts?: JobsOptions,
): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new QueueUnavailableError()),
      ENQUEUE_TIMEOUT_MS,
    );
  });
  try {
    // BullMQ's generic job name type is too narrow for a shared helper.
    const queue = getQueue(name) as unknown as Queue<JobData[N]>;
    await Promise.race([
      (
        queue.add as (
          n: string,
          d: JobData[N],
          o?: JobsOptions,
        ) => Promise<unknown>
      )(jobName, data, opts),
      timeout,
    ]);
  } finally {
    clearTimeout(timer);
  }
}

/** Custom job ids: only letters, digits, "-" and "_" (no ":" - BullMQ's separator). */
function jobId(...parts: Array<string | number>): string {
  return parts.map((p) => String(p).replace(/[^A-Za-z0-9_-]/g, "_")).join("-");
}

/**
 * Publishes one post target. `stamp` makes the id unique per request: a
 * finished job keeps its id in Redis for days, so a later publish of the same
 * target (a new date, a retry after an error) must not reuse it.
 */
export async function enqueuePublish(
  targetId: string,
  stamp: number | string = Date.now(),
): Promise<void> {
  await add(
    "publish",
    "publish-target",
    { targetId },
    {
      jobId: jobId("publish", targetId, stamp),
    },
  );
}

export async function enqueueGenerationRun(runId: string): Promise<void> {
  await add(
    "content-generation",
    "generate",
    { runId },
    { jobId: jobId("gen", runId) },
  );
}

export async function enqueueGbpAudit(runId: string): Promise<void> {
  await add("gbp-audit", "audit", { runId }, { jobId: jobId("audit", runId) });
}

export async function enqueueRankScan(scanId: string): Promise<void> {
  await add("rank-scan", "scan", { scanId }, { jobId: jobId("scan", scanId) });
}

export async function enqueueReviewSync(runId: string): Promise<void> {
  await add("reviews", "sync", { runId }, { jobId: jobId("sync", runId) });
}

/** Background refresh of one snapshot row (the caller has claimed it). */
export async function enqueueSnapshotRefresh(input: {
  tokenProfileId: string;
  target: SnapshotTarget;
}): Promise<void> {
  await add("maintenance", "snapshot-refresh", {
    task: "snapshot-refresh",
    ...input,
  });
}

/** Adds a maintenance job right away (cyclic ones use worker/schedules.ts). */
export async function enqueueMaintenance(job: MaintenanceJob): Promise<void> {
  await add("maintenance", job.task, job);
}

/** Closes the app's queue connections (scripts and tests). */
export async function closeQueues(): Promise<void> {
  await Promise.all([...queues.values()].map((queue) => queue.close()));
  queues.clear();
}
