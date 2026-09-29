import { and, desc, eq, lt } from "drizzle-orm";
import { reviewSyncRuns, type ReviewSyncRun } from "@/lib/db/schema";
import { SYNC_FRESH_MS, SYNC_STALE_MS } from "@/features/opinie/review-rules";
import { reviewDeps, type ReviewDeps } from "@/features/opinie/review-deps";

/** Postgres unique violation, also when the driver wraps it. */
function isUniqueViolation(error: unknown): boolean {
  const code = (error as { code?: string })?.code;
  const causeCode = (error as { cause?: { code?: string } })?.cause?.code;
  return code === "23505" || causeCode === "23505";
}

/** A `running` run older than the stale limit counts as failed. */
export function isRunStale(
  run: Pick<ReviewSyncRun, "status" | "startedAt">,
  now: Date,
) {
  return (
    run.status === "running" &&
    now.getTime() - run.startedAt.getTime() > SYNC_STALE_MS
  );
}

/**
 * Creates the run row. One `running` run per profile (a partial unique index
 * enforces it); a hung one is closed as failed first.
 */
export async function startReviewSync(
  profileId: string,
  deps: ReviewDeps = reviewDeps(),
): Promise<{ runId: string; started: boolean }> {
  const { db, now } = deps;
  const cutoff = new Date(now().getTime() - SYNC_STALE_MS);

  await db
    .update(reviewSyncRuns)
    .set({
      status: "failed",
      error: "Sprawdzanie opinii zostało przerwane",
      finishedAt: now(),
    })
    .where(
      and(
        eq(reviewSyncRuns.profileId, profileId),
        eq(reviewSyncRuns.status, "running"),
        lt(reviewSyncRuns.startedAt, cutoff),
      ),
    );

  try {
    const [run] = await db
      .insert(reviewSyncRuns)
      .values({ profileId, status: "running", startedAt: now() })
      .returning({ id: reviewSyncRuns.id });
    return { runId: run.id, started: true };
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    const [running] = await db
      .select({ id: reviewSyncRuns.id })
      .from(reviewSyncRuns)
      .where(
        and(
          eq(reviewSyncRuns.profileId, profileId),
          eq(reviewSyncRuns.status, "running"),
        ),
      )
      .limit(1);
    if (!running) throw error;
    return { runId: running.id, started: false };
  }
}

export type ReviewSyncState = {
  /** A sync is in progress right now */
  running: boolean;
  runId: string | null;
  /** When the last finished (successful) sync ended */
  lastSyncedAt: Date | null;
  /** Error of the newest finished run, when it failed */
  lastError: string | null;
  averageRating: number | null;
  totalCount: number | null;
};

/** Latest runs of a profile, reduced to what the list header needs. */
export async function loadReviewSyncState(
  profileId: string,
  deps: ReviewDeps = reviewDeps(),
): Promise<ReviewSyncState> {
  const { db, now } = deps;
  const runs = await db
    .select()
    .from(reviewSyncRuns)
    .where(eq(reviewSyncRuns.profileId, profileId))
    .orderBy(desc(reviewSyncRuns.startedAt))
    .limit(10);

  const at = now();
  const running = runs.find(
    (run) => run.status === "running" && !isRunStale(run, at),
  );
  const finished = runs.filter(
    (run) => run.status !== "running" || isRunStale(run, at),
  );
  const lastDone = finished.find((run) => run.status === "done");
  const newest = finished[0];

  return {
    running: Boolean(running),
    runId: running?.id ?? null,
    lastSyncedAt: lastDone?.finishedAt ?? null,
    lastError:
      newest && newest.status !== "done"
        ? (newest.error ?? "Sprawdzanie opinii nie powiodło się")
        : null,
    averageRating:
      lastDone?.averageRating != null ? Number(lastDone.averageRating) : null,
    totalCount: lastDone?.totalCount ?? null,
  };
}

/**
 * Opening /opinie starts a sync only when the newest finished run (good or
 * failed) is older than 15 minutes and none is running - a failing profile is
 * not hammered on every page view ("Odśwież" always works).
 */
export function isSyncDue(
  runs: Pick<ReviewSyncRun, "status" | "startedAt" | "finishedAt">[],
  now: Date,
): boolean {
  const sorted = [...runs].sort(
    (a, b) => b.startedAt.getTime() - a.startedAt.getTime(),
  );
  if (sorted.some((run) => run.status === "running" && !isRunStale(run, now))) {
    return false;
  }
  const newest = sorted.find(
    (run) => run.status !== "running" || isRunStale(run, now),
  );
  if (!newest) return true;
  const ended = newest.finishedAt ?? newest.startedAt;
  return now.getTime() - ended.getTime() > SYNC_FRESH_MS;
}

export async function isReviewSyncDue(
  profileId: string,
  deps: ReviewDeps = reviewDeps(),
): Promise<boolean> {
  const runs = await deps.db
    .select({
      status: reviewSyncRuns.status,
      startedAt: reviewSyncRuns.startedAt,
      finishedAt: reviewSyncRuns.finishedAt,
    })
    .from(reviewSyncRuns)
    .where(eq(reviewSyncRuns.profileId, profileId))
    .orderBy(desc(reviewSyncRuns.startedAt))
    .limit(10);
  return isSyncDue(runs, deps.now());
}
