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

/** One review as a channel reports it (already mapped to plain values). */
export type ChannelReview = {
  /** Channel-side id (Google: reviewId) */
  externalId: string;
  /** 1-5; null when the channel sent no usable rating */
  rating: number | null;
  authorName: string;
  authorPhotoUrl: string | null;
  /** Raw text (may hold a "(Translated by Google)" block); null = stars only */
  comment: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
  /** Set when somebody already replied - also outside the panel */
  reply: { text: string; updatedAt: Date | null } | null;
};

export type ReviewsPage = {
  /** Newest change first */
  reviews: ChannelReview[];
  nextPageToken: string | null;
  averageRating: number | null;
  totalCount: number | null;
};

/**
 * Reviews of one profile on one channel. Built per profile (see
 * lib/integrations/reviews.ts), so an instance knows the location and token.
 */
export interface ChannelReviews {
  /** One page, sorted by last change (newest first). */
  fetchReviews(pageToken: string | null): Promise<ReviewsPage>;
  /**
   * Creates or REPLACES the reply. Calling it again with the same text is
   * safe (unlike publishing a post), so retries need no de-duplication.
   * Returns when the channel stored the reply.
   */
  replyToReview(
    externalId: string,
    text: string,
  ): Promise<{ repliedAt: Date | null }>;
  deleteReply(externalId: string): Promise<void>;
}

/** Error whose message is safe and readable for the customer. */
export class ChannelReviewError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ChannelReviewError";
  }
}
