import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { contentItems, contentTargets } from "@/lib/db/schema";
import { CHANNEL_PUBLISHERS } from "@/lib/integrations/publishers";
import { publishQueuedTargets } from "@/features/publikacje/publish-core";

/**
 * Publishes the item's queued targets and stores each result. Runs after the
 * response (no session) - targets were validated against the account at accept time.
 * Safe to call from after() or, later, from a BullMQ worker.
 */
export async function publishTargets(itemId: string): Promise<void> {
  try {
    const [item] = await db
      .select()
      .from(contentItems)
      .where(eq(contentItems.id, itemId))
      .limit(1);
    if (!item) return;

    const targets = await db
      .select()
      .from(contentTargets)
      .where(
        and(
          eq(contentTargets.contentItemId, item.id),
          eq(contentTargets.status, "queued"),
        ),
      );

    const outcomes = await publishQueuedTargets(
      item,
      targets,
      CHANNEL_PUBLISHERS,
    );

    for (const outcome of outcomes) {
      await db
        .update(contentTargets)
        .set(
          outcome.status === "published"
            ? {
                status: "published",
                externalId: outcome.externalId,
                publishedAt: outcome.publishedAt,
                error: null,
              }
            : { status: "failed", error: outcome.error },
        )
        .where(eq(contentTargets.id, outcome.targetId));
    }
  } catch (error) {
    console.error("publishTargets failed:", error);
    await db
      .update(contentTargets)
      .set({
        status: "failed",
        error: "Nie udało się opublikować - spróbuj ponownie",
      })
      .where(
        and(
          eq(contentTargets.contentItemId, itemId),
          eq(contentTargets.status, "queued"),
        ),
      );
  }
}
