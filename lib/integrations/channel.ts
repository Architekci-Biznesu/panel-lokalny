import type {
  ContentChannel,
  ContentItem,
  ContentTarget,
} from "@/lib/db/schema";

/**
 * One adapter per publishing channel. Business logic never branches on the
 * channel - it looks the implementation up in CHANNEL_PUBLISHERS
 * (lib/integrations/publishers.ts). A new channel (e.g. Meta) = new folder in
 * lib/integrations/<channel>/ + one entry in that map.
 */
export type PublishResult = {
  /** Channel-side id of the post (Google: localPost `name`) */
  externalId: string;
};

export interface ChannelPublisher {
  publish(item: ContentItem, target: ContentTarget): Promise<PublishResult>;
}

/** Error whose message is safe and readable for the customer. */
export class ChannelPublishError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ChannelPublishError";
  }
}

export type ChannelPublishers = Partial<
  Record<ContentChannel, ChannelPublisher>
>;
