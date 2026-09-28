import type { ChannelPublishers } from "@/lib/integrations/channel";
import type { ContentChannel } from "@/lib/db/schema";
import { gbpPublisher } from "@/lib/integrations/gbp/publisher";

/** Channel -> implementation. Channels without an entry are shown as "wkrótce". */
export const CHANNEL_PUBLISHERS: ChannelPublishers = {
  gbp: gbpPublisher,
};

export function isChannelAvailable(channel: ContentChannel): boolean {
  return Boolean(CHANNEL_PUBLISHERS[channel]);
}
