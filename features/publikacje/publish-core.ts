import type { ContentItem, ContentTarget } from "@/lib/db/schema";
import {
  ChannelPublishError,
  PUBLISH_UNKNOWN_OUTCOME_MESSAGE,
  type ChannelPublishers,
  type PublishRetry,
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
  | {
      targetId: string;
      status: "failed";
      error: string;
      /** Whether the worker may try again (see PublishRetry). */
      retry: PublishRetry;
    };

/** Status of a new target: a future date waits for the worker's scheduled-posts job. */
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
 * Publishes one target already claimed by the worker (status `publishing`).
 * Never throws - the outcome says what happened and whether a retry is safe.
 */
export async function publishOneTarget(
  item: ContentItem,
  target: ContentTarget,
  publishers: ChannelPublishers,
  now: () => Date = () => new Date(),
): Promise<TargetOutcome> {
  const publisher = publishers[target.channel];
  if (!publisher) {
    return {
      targetId: target.id,
      status: "failed",
      error: CHANNEL_SOON_MESSAGE,
      retry: "final",
    };
  }

  try {
    const result = await publisher.publish(item, target);
    return {
      targetId: target.id,
      status: "published",
      externalId: result.externalId,
      publishedAt: now(),
    };
  } catch (error) {
    if (error instanceof ChannelPublishError) {
      return {
        targetId: target.id,
        status: "failed",
        error: error.message,
        retry: error.retry,
      };
    }
    // A raw error from inside the adapter: nobody knows how far it got.
    console.error("Content publish failed:", error);
    return {
      targetId: target.id,
      status: "failed",
      error: PUBLISH_UNKNOWN_OUTCOME_MESSAGE,
      retry: "unknown",
    };
  }
}
