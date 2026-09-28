import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  contentTargets,
  profiles,
  type ContentChannel,
  type ContentTargetStatus,
} from "@/lib/db/schema";

export type TargetView = {
  id: string;
  contentItemId: string;
  profileId: string;
  profileName: string;
  channel: ContentChannel;
  status: ContentTargetStatus;
  scheduledAt: Date | null;
  publishedAt: Date | null;
  externalId: string | null;
  error: string | null;
};

/**
 * Targets of the given items, limited to profiles of the active account
 * (filtered in the query, not only in the UI).
 */
export async function loadTargetsForItems(
  accountId: string,
  itemIds: string[],
): Promise<TargetView[]> {
  if (itemIds.length === 0) return [];
  return db
    .select({
      id: contentTargets.id,
      contentItemId: contentTargets.contentItemId,
      profileId: contentTargets.profileId,
      profileName: profiles.name,
      channel: contentTargets.channel,
      status: contentTargets.status,
      scheduledAt: contentTargets.scheduledAt,
      publishedAt: contentTargets.publishedAt,
      externalId: contentTargets.externalId,
      error: contentTargets.error,
    })
    .from(contentTargets)
    .innerJoin(profiles, eq(profiles.id, contentTargets.profileId))
    .where(
      and(
        inArray(contentTargets.contentItemId, itemIds),
        eq(profiles.accountId, accountId),
      ),
    );
}

export function groupByItem<T extends { contentItemId: string }>(
  rows: T[],
): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const list = map.get(row.contentItemId) ?? [];
    list.push(row);
    map.set(row.contentItemId, list);
  }
  return map;
}
