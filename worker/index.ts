/**
 * Background worker (Faza 5) - a separate process next to Next.js:
 *
 *   npm run worker      (tsx resolves the "@/" alias from tsconfig.json;
 *                        locally env comes from .env.local)
 *
 * Runs the jobs the app adds through lib/queue and the cyclic ones from
 * worker/schedules.ts. Everything it imports is checked by
 * worker/no-session-imports.test.ts: no next/*, lib/session or lib/auth.
 *
 * Deploy (Coolify): a second service from the same repo, start command
 * `npm run worker`, the same environment variables as the app (DATABASE_URL,
 * REDIS_URL, Google, AI, storage keys). Set its stop grace period to about
 * 120 s - Docker's default ~10 s kills an AI generation in the middle and
 * every deploy would end with interrupted runs. On SIGTERM the worker takes
 * no new jobs and waits for the running ones. A post request to Google times
 * out after PUBLISH_REQUEST_TIMEOUT_MS (30 s), well below that grace period.
 */
import { Worker, type Job } from "bullmq";
import { workerConnection } from "@/lib/queue/connection";
import {
  QUEUE_NAMES,
  closeQueues,
  getQueue,
  type QueueName,
} from "@/lib/queue";
import { processors } from "./processors";
import { upsertSchedules } from "./schedules";

/** Jobs of one queue running at the same time in this process. */
const CONCURRENCY: Record<QueueName, number> = {
  publish: 2,
  "content-generation": 2,
  "gbp-audit": 1,
  "rank-scan": 2,
  reviews: 2,
  maintenance: 4,
};

function describe(job: Job | undefined): string {
  return job ? `${job.queueName}/${job.name} ${job.id}` : "?";
}

async function main() {
  const workers = QUEUE_NAMES.map((name) => {
    const worker = new Worker(
      name,
      processors[name] as (job: Job) => Promise<unknown>,
      { connection: workerConnection(), concurrency: CONCURRENCY[name] },
    );
    worker.on("failed", (job, error) =>
      console.error(`[worker] failed ${describe(job)}: ${error.message}`),
    );
    worker.on("error", (error) =>
      console.error(`[worker] ${name}: ${error.message}`),
    );
    return worker;
  });

  await upsertSchedules(getQueue("maintenance"));
  console.info(`[worker] ready: ${QUEUE_NAMES.join(", ")}`);

  let closing = false;
  const shutdown = async (signal: string) => {
    if (closing) return;
    closing = true;
    console.info(`[worker] ${signal}: finishing running jobs...`);
    // close() stops taking new jobs and waits for the active ones.
    await Promise.all(workers.map((worker) => worker.close()));
    await closeQueues();
    console.info("[worker] stopped");
    process.exit(0);
  };
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

main().catch((error) => {
  console.error("[worker] start failed:", error);
  process.exit(1);
});
