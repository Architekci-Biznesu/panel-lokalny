import { and, eq, inArray, lte, or } from "drizzle-orm";
import { db as defaultDb } from "@/lib/db";
import {
  contentItems,
  contentTargets,
  type ContentTarget,
} from "@/lib/db/schema";
import {
  PUBLISH_UNKNOWN_OUTCOME_MESSAGE,
  type ChannelPublishers,
} from "@/lib/integrations/channel";
import { CHANNEL_PUBLISHERS } from "@/lib/integrations/publishers";
import { publishOneTarget } from "@/features/publikacje/publish-core";

/**
 * Worker runner of the `publish` queue: one post target per job. No session,
 * no next/* - the target was validated against the account at accept time.
 *
 * Google has no idempotency key for posts, so a duplicate is prevented here,
 * in the database: the target is claimed atomically (`publishing`) before the
 * request, and only a claimed target is sent. A second job for the same
 * target (retry, stalled job after a crash, the scheduler adding it again)
 * finds nothing to claim and ends without a request.
 */

export type PublishJobDeps = {
  db: typeof defaultDb;
  publishers: ChannelPublishers;
  now: () => Date;
};

export function publishJobDeps(
  overrides: Partial<PublishJobDeps> = {},
): PublishJobDeps {
  return {
    db: defaultDb,
    publishers: CHANNEL_PUBLISHERS,
    now: () => new Date(),
    ...overrides,
  };
}

export type PublishJobResult =
  /** Someone else claimed the target, or it is not due / no longer exists. */
  | { kind: "skipped" }
  | { kind: "published" }
  /** Transient error, the target is back in `queued` - the job must be retried. */
  | { kind: "retry"; error: string }
  | { kind: "failed"; error: string };

/**
 * `queued` -> `publishing`, or a due `scheduled` one (a later date set after
 * the job was added keeps it waiting). Returns the row only to the winner.
 */
export async function claimPublishTarget(
  targetId: string,
  deps: Pick<PublishJobDeps, "db" | "now">,
): Promise<ContentTarget | null> {
  const now = deps.now();
  const [claimed] = await deps.db
    .update(contentTargets)
    .set({ status: "publishing", claimedAt: now, error: null })
    .where(
      and(
        eq(contentTargets.id, targetId),
        or(
          eq(contentTargets.status, "queued"),
          and(
            eq(contentTargets.status, "scheduled"),
            lte(contentTargets.scheduledAt, now),
          ),
        ),
      ),
    )
    .returning();
  return claimed ?? null;
}

/**
 * Publishes one target. `attempt` is 1-based; on a transient error before the
 * last attempt the target goes back to `queued` and the caller retries the
 * job. Unknown results and errors that would repeat end as `failed` at once.
 */
export async function publishTarget(
  targetId: string,
  attempt: { number: number; max: number },
  deps: PublishJobDeps = publishJobDeps(),
): Promise<PublishJobResult> {
  const target = await claimPublishTarget(targetId, deps);
  if (!target) return { kind: "skipped" };

  const [item] = await deps.db
    .select()
    .from(contentItems)
    .where(eq(contentItems.id, target.contentItemId))
    .limit(1);

  const outcome = item
    ? await publishOneTarget(item, target, deps.publishers, deps.now)
    : {
        targetId,
        status: "failed" as const,
        error: "Post nie istnieje",
        retry: "final" as const,
      };

  const mine = and(
    eq(contentTargets.id, targetId),
    eq(contentTargets.status, "publishing"),
  );

  if (outcome.status === "published") {
    await deps.db
      .update(contentTargets)
      .set({
        status: "published",
        externalId: outcome.externalId,
        publishedAt: outcome.publishedAt,
        error: null,
        claimedAt: null,
      })
      .where(mine);
    return { kind: "published" };
  }

  if (outcome.retry === "retry" && attempt.number < attempt.max) {
    await deps.db
      .update(contentTargets)
      .set({ status: "queued", error: outcome.error, claimedAt: null })
      .where(mine);
    return { kind: "retry", error: outcome.error };
  }

  const error =
    outcome.retry === "unknown"
      ? PUBLISH_UNKNOWN_OUTCOME_MESSAGE
      : outcome.error;
  await deps.db
    .update(contentTargets)
    .set({ status: "failed", error, claimedAt: null })
    .where(mine);
  return { kind: "failed", error };
}

/** Targets of an item waiting to go out now (accept without a date). */
export async function queuedTargetIds(
  itemId: string,
  deps: Pick<PublishJobDeps, "db"> = { db: defaultDb },
): Promise<string[]> {
  const rows = await deps.db
    .select({ id: contentTargets.id })
    .from(contentTargets)
    .where(
      and(
        eq(contentTargets.contentItemId, itemId),
        inArray(contentTargets.status, ["queued"]),
      ),
    );
  return rows.map((row) => row.id);
}
