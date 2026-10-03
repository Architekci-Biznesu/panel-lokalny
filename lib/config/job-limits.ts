/**
 * Background jobs (worker, Faza 5): when a run counts as dead and how often
 * cyclic jobs run. Keep out of UI components. Rank scans use
 * RANK_STALE_RUNNING_MS (rank-limits.ts), review syncs SYNC_STALE_MS
 * (features/opinie/review-rules.ts) - not repeated here.
 */

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

/** Topics / posts generation `running` longer than this is marked failed. */
export const CONTENT_GENERATION_STALE_MS = 20 * MINUTE;

/** Listing analysis `running` longer than this is marked failed. */
export const GBP_AUDIT_STALE_MS = 15 * MINUTE;

/**
 * A post target stuck in `publishing` longer than this: the result is unknown
 * (the post may exist in Google) - marked failed, never retried automatically.
 */
export const PUBLISH_TARGET_STALE_MS = 10 * MINUTE;

/** Publishing a post: attempts for transient Google errors (5xx, 429, 408). */
export const PUBLISH_ATTEMPTS = 3;
/** First retry delay; BullMQ doubles it each time (exponential). */
export const PUBLISH_BACKOFF_MS = 30 * 1000;

/**
 * Timeout of the request that creates a post in Google. Must stay well below
 * the worker's stop grace period in Coolify (~120 s, see worker/index.ts) so a
 * deploy never kills the worker in the middle of this request.
 */
export const PUBLISH_REQUEST_TIMEOUT_MS = 30 * 1000;

/** Review sync for profiles in auto mode - replies go out without opening the panel. */
export const REVIEW_SYNC_AUTO_EVERY_MS = 30 * MINUTE;
/** Review sync for the other connected profiles (Faza 7 shortens it with notifications). */
export const REVIEW_SYNC_OTHER_EVERY_MS = 3 * HOUR;

/** How long finished / failed jobs stay in Redis (Bull Board history). */
export const JOB_KEEP_SECONDS = 7 * 24 * 60 * 60;

/** `accounts.last_active_at` is written at most this often per account. */
export const ACTIVITY_WRITE_EVERY_MS = 15 * MINUTE;
