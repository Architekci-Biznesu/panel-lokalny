import { and, eq, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import { contentTargets } from "@/lib/db/schema";
import { enqueuePublish } from "@/lib/queue";

/**
 * Every minute: scheduled post targets whose time has come go to the
 * `publish` queue. The database is the source of truth - a new date or a
 * cancelled post is a plain write there, nothing waits in Redis. If two runs
 * overlap, the claim in publishTarget() lets only one job publish.
 */
export async function enqueueDueScheduledPosts(
  now: Date = new Date(),
): Promise<number> {
  const due = await db
    .select({ id: contentTargets.id, scheduledAt: contentTargets.scheduledAt })
    .from(contentTargets)
    .where(
      and(
        eq(contentTargets.status, "scheduled"),
        lte(contentTargets.scheduledAt, now),
      ),
    );
  for (const target of due) {
    // One job per target and date: the next minute's run does not add it again.
    await enqueuePublish(
      target.id,
      `at${target.scheduledAt?.getTime() ?? now.getTime()}`,
    );
  }
  return due.length;
}
