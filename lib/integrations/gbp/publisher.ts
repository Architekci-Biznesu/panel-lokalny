import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  profiles,
  type ContentItem,
  type ContentTarget,
} from "@/lib/db/schema";
import {
  ChannelPublishError,
  type ChannelPublisher,
} from "@/lib/integrations/channel";
import { getGbpAccessTokenForProfile } from "@/lib/integrations/gbp/access";
import {
  GbpNotConnectedError,
  isGbpUnauthenticatedError,
} from "@/lib/integrations/gbp/errors";
import { gbpPublishErrorMessage } from "@/lib/integrations/gbp/publish-errors";
import { createGbpLocalPost } from "@/lib/integrations/gbp/client";
import { withGbpV4LocationName } from "@/lib/integrations/gbp/v4-name";

export const gbpPublisher: ChannelPublisher = {
  async publish(item: ContentItem, target: ContentTarget) {
    // Background job: the target row was validated against the account at
    // accept time, so the profile is loaded by id (no session here).
    const [profile] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.id, target.profileId))
      .limit(1);

    try {
      if (!profile?.gbpLocationId || !profile.oauthConnectionId) {
        throw new GbpNotConnectedError();
      }
      const input = { summary: item.body, imageUrl: item.imageUrl };
      let token = await getGbpAccessTokenForProfile(profile);
      try {
        const post = await withGbpV4LocationName(profile, token, (v4) =>
          createGbpLocalPost(token, v4, input),
        );
        return { externalId: post.name };
      } catch (error) {
        if (!isGbpUnauthenticatedError(error)) throw error;
        token = await getGbpAccessTokenForProfile(profile, { force: true });
        const post = await withGbpV4LocationName(profile, token, (v4) =>
          createGbpLocalPost(token, v4, input),
        );
        return { externalId: post.name };
      }
    } catch (error) {
      throw new ChannelPublishError(gbpPublishErrorMessage(error));
    }
  },
};
