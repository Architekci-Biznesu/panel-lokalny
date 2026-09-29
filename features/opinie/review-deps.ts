import { getTextProvider } from "@/lib/ai";
import type { GenerateReviewReplyInput } from "@/lib/ai/types";
import { db } from "@/lib/db";
import type { Profile } from "@/lib/db/schema";
import type { ChannelReviews } from "@/lib/integrations/channel";
import { CHANNEL_REVIEWS } from "@/lib/integrations/reviews";

/**
 * What the review background jobs need from outside. Everything here is
 * injectable so tests run against a fake channel and fake AI (never Google).
 * No session and no next/* - Phase 5 moves these jobs to a worker as they are.
 */
export type Database = typeof db;

export type ReviewDeps = {
  db: Database;
  /** The profile's reviews on its channel (only Google exists today) */
  channelFor: (profile: Profile) => ChannelReviews;
  generateReply: (input: GenerateReviewReplyInput) => Promise<string>;
  now: () => Date;
};

export function reviewDeps(overrides: Partial<ReviewDeps> = {}): ReviewDeps {
  return {
    db,
    channelFor(profile) {
      const factory = CHANNEL_REVIEWS.gbp;
      if (!factory) throw new Error("Kanał opinii nie jest dostępny");
      return factory(profile);
    },
    generateReply: (input) => getTextProvider().generateReviewReply(input),
    now: () => new Date(),
    ...overrides,
  };
}
