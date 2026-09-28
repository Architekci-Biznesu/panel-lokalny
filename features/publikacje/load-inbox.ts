import { and, count, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  contentItems,
  contentRevisions,
  contentChannelEnum,
  type ContentChannel,
  type Profile,
} from "@/lib/db/schema";
import { isChannelAvailable } from "@/lib/integrations/publishers";
import { listAccountProfileOptions } from "@/lib/session";
import { groupSiblings } from "@/features/publikacje/group-targets";

export type InboxItem = {
  id: string;
  title: string;
  body: string;
  imageUrl: string | null;
  createdAt: Date;
  revisionCount: number;
};

export type ChannelOption = {
  channel: ContentChannel;
  available: boolean;
};

export type InboxData = {
  items: InboxItem[];
  channels: ChannelOption[];
  /** Other profiles of the active profile's publish group */
  groupSiblings: Array<{ id: string; name: string }>;
  groupName: string | null;
};

export async function countPendingContent(profileId: string): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(contentItems)
    .where(
      and(
        eq(contentItems.profileId, profileId),
        eq(contentItems.status, "pending"),
      ),
    );
  return row?.value ?? 0;
}

export async function loadInbox(profile: Profile): Promise<InboxData> {
  const rows = await db
    .select({
      id: contentItems.id,
      title: contentItems.title,
      body: contentItems.body,
      imageUrl: contentItems.imageUrl,
      createdAt: contentItems.createdAt,
      revisionCount: count(contentRevisions.id),
    })
    .from(contentItems)
    .leftJoin(
      contentRevisions,
      eq(contentRevisions.contentItemId, contentItems.id),
    )
    .where(
      and(
        eq(contentItems.profileId, profile.id),
        eq(contentItems.status, "pending"),
      ),
    )
    .groupBy(contentItems.id)
    .orderBy(desc(contentItems.createdAt));

  const options = await listAccountProfileOptions();
  const siblings = groupSiblings(profile.id, options);
  const own = options.find((option) => option.id === profile.id);

  return {
    items: rows,
    channels: contentChannelEnum.enumValues.map((channel) => ({
      channel,
      available: isChannelAvailable(channel),
    })),
    groupSiblings: siblings.map(({ id, name }) => ({ id, name })),
    groupName: siblings.length ? (own?.groupName ?? null) : null,
  };
}
