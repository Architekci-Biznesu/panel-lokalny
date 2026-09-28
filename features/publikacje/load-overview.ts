import { and, asc, desc, eq, gte } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  contentItems,
  contentTargets,
  type ContentChannel,
  type ContentTargetStatus,
  type Profile,
} from "@/lib/db/schema";

export type OverviewTarget = {
  targetId: string;
  itemId: string;
  title: string;
  body: string;
  channel: ContentChannel;
  status: ContentTargetStatus;
  date: Date | null;
  error: string | null;
};

export type OverviewData = {
  pending: Array<{ id: string; title: string; createdAt: Date }>;
  pendingCount: number;
  scheduled: OverviewTarget[];
  published: OverviewTarget[];
  failed: OverviewTarget[];
};

const LIST_LIMIT = 5;

async function targetsOf(
  profile: Profile,
  status: ContentTargetStatus,
  limit: number,
): Promise<OverviewTarget[]> {
  const base = db
    .select({
      targetId: contentTargets.id,
      itemId: contentItems.id,
      title: contentItems.title,
      body: contentItems.body,
      channel: contentTargets.channel,
      status: contentTargets.status,
      scheduledAt: contentTargets.scheduledAt,
      publishedAt: contentTargets.publishedAt,
      error: contentTargets.error,
      createdAt: contentItems.createdAt,
    })
    .from(contentTargets)
    .innerJoin(contentItems, eq(contentItems.id, contentTargets.contentItemId));

  const rows =
    status === "scheduled"
      ? await base
          .where(
            and(
              eq(contentTargets.profileId, profile.id),
              eq(contentTargets.status, "scheduled"),
              gte(contentTargets.scheduledAt, new Date()),
            ),
          )
          .orderBy(asc(contentTargets.scheduledAt))
          .limit(limit)
      : await base
          .where(
            and(
              eq(contentTargets.profileId, profile.id),
              eq(contentTargets.status, status),
            ),
          )
          .orderBy(
            desc(
              status === "published"
                ? contentTargets.publishedAt
                : contentItems.createdAt,
            ),
          )
          .limit(limit);

  return rows.map((row) => ({
    targetId: row.targetId,
    itemId: row.itemId,
    title: row.title,
    body: row.body,
    channel: row.channel,
    status: row.status,
    date: row.publishedAt ?? row.scheduledAt ?? row.createdAt,
    error: row.error,
  }));
}

/** Latest published posts of a profile - also used by the Pulpit tile. */
export function loadRecentPublished(
  profile: Profile,
  limit = LIST_LIMIT,
): Promise<OverviewTarget[]> {
  return targetsOf(profile, "published", limit);
}

export async function loadOverview(profile: Profile): Promise<OverviewData> {
  const pendingRows = await db
    .select({
      id: contentItems.id,
      title: contentItems.title,
      createdAt: contentItems.createdAt,
    })
    .from(contentItems)
    .where(
      and(
        eq(contentItems.profileId, profile.id),
        eq(contentItems.status, "pending"),
      ),
    )
    .orderBy(desc(contentItems.createdAt));

  const [scheduled, published, failed] = await Promise.all([
    targetsOf(profile, "scheduled", LIST_LIMIT),
    targetsOf(profile, "published", LIST_LIMIT),
    targetsOf(profile, "failed", 3),
  ]);

  return {
    pending: pendingRows.slice(0, LIST_LIMIT),
    pendingCount: pendingRows.length,
    scheduled,
    published,
    failed,
  };
}
