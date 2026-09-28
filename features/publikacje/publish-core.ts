import type { ContentItem, ContentTarget } from "@/lib/db/schema";
import {
  ChannelPublishError,
  type ChannelPublishers,
} from "@/lib/integrations/channel";

/** A date this far ahead counts as "scheduled" rather than "publish now". */
const SCHEDULE_THRESHOLD_MS = 60_000;

export const CHANNEL_SOON_MESSAGE = "Ten kanał będzie dostępny wkrótce";

export type TargetOutcome =
  | {
      targetId: string;
      status: "published";
      externalId: string;
      publishedAt: Date;
    }
  | { targetId: string; status: "failed"; error: string };

/** Status of a new target: future date waits for the scheduler (Faza 5). */
export function initialTargetStatus(
  scheduledAt: Date | null | undefined,
  now: Date = new Date(),
): "queued" | "scheduled" {
  return scheduledAt &&
    scheduledAt.getTime() - now.getTime() > SCHEDULE_THRESHOLD_MS
    ? "scheduled"
    : "queued";
}

/**
 * Publishes every queued target independently - one failure never stops the
 * rest. Returns one outcome per queued target.
 */
export async function publishQueuedTargets(
  item: ContentItem,
  targets: ContentTarget[],
  publishers: ChannelPublishers,
  now: () => Date = () => new Date(),
): Promise<TargetOutcome[]> {
  const outcomes: TargetOutcome[] = [];

  for (const target of targets) {
    if (target.status !== "queued") continue;

    const publisher = publishers[target.channel];
    if (!publisher) {
      outcomes.push({
        targetId: target.id,
        status: "failed",
        error: CHANNEL_SOON_MESSAGE,
      });
      continue;
    }

    try {
      const result = await publisher.publish(item, target);
      outcomes.push({
        targetId: target.id,
        status: "published",
        externalId: result.externalId,
        publishedAt: now(),
      });
    } catch (error) {
      outcomes.push({
        targetId: target.id,
        status: "failed",
        error:
          error instanceof ChannelPublishError
            ? error.message
            : "Nie udało się opublikować - spróbuj ponownie",
      });
      if (!(error instanceof ChannelPublishError)) {
        console.error("Content publish failed:", error);
      }
    }
  }

  return outcomes;
}
