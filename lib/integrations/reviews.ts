import type { ContentChannel, Profile } from "@/lib/db/schema";
import type { ChannelReviews } from "@/lib/integrations/channel";
import { createGbpReviews } from "@/lib/integrations/gbp/reviews";

/**
 * One adapter per channel for reading and answering reviews. Business logic
 * never branches on the channel - it looks the factory up here. Meta later =
 * a new folder in lib/integrations/ + one entry (no stubs before that).
 */
export type ChannelReviewsFactory = (profile: Profile) => ChannelReviews;

export const CHANNEL_REVIEWS: Partial<
  Record<ContentChannel, ChannelReviewsFactory>
> = {
  gbp: createGbpReviews,
};
