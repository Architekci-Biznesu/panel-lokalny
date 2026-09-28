import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  contentItems,
  contentTargets,
  type ContentChannel,
  type Profile,
} from "@/lib/db/schema";

export type PublishedTarget = {
  targetId: string;
  itemId: string;
  title: string;
  channel: ContentChannel;
  date: Date | null;
};

/** Latest posts actually published to this profile (Pulpit tile). */
export async function loadRecentPublished(
  profile: Profile,
  limit = 5,
): Promise<PublishedTarget[]> {
  const rows = await db
    .select({
      targetId: contentTargets.id,
      itemId: contentItems.id,
      title: contentItems.title,
      channel: contentTargets.channel,
      publishedAt: contentTargets.publishedAt,
    })
    .from(contentTargets)
    .innerJoin(contentItems, eq(contentItems.id, contentTargets.contentItemId))
    .where(
      and(
        eq(contentTargets.profileId, profile.id),
        eq(contentTargets.status, "published"),
      ),
    )
    .orderBy(desc(contentTargets.publishedAt))
    .limit(limit);

  return rows.map(({ publishedAt, ...row }) => ({ ...row, date: publishedAt }));
}
