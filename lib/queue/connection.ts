import type { ConnectionOptions } from "bullmq";

/**
 * Redis for BullMQ (Faza 5). The app only adds jobs; the worker process
 * (worker/index.ts) runs them. No session, no next/* - both sides import it.
 */

function redisUrl(): string {
  const url = process.env.REDIS_URL;
  if (!url) throw new Error("REDIS_URL is not set");
  return url;
}

/** App side (server actions, pages): adding jobs. */
export function appConnection(): ConnectionOptions {
  return { url: redisUrl(), maxRetriesPerRequest: 3 };
}

/**
 * Worker side. BullMQ needs `maxRetriesPerRequest: null` for its blocking
 * commands - without it the worker throws at start.
 */
export function workerConnection(): ConnectionOptions {
  return { url: redisUrl(), maxRetriesPerRequest: null };
}
