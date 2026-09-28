import { desc, eq, inArray, or } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  contentItems,
  contentTargets,
  type ContentChannel,
  type Profile,
} from "@/lib/db/schema";
import {
  contentDisplayStatus,
  matchesStatusFilter,
  type ContentDisplayStatus,
  type HistoryStatusFilter,
} from "@/features/publikacje/content-status";
import {
  groupByItem,
  loadTargetsForItems,
  type TargetView,
} from "@/features/publikacje/load-shared";

const HISTORY_LIMIT = 200;

export type HistoryItem = {
  id: string;
  title: string;
  body: string;
  imageUrl: string | null;
  createdAt: Date;
  status: ContentDisplayStatus;
  targets: TargetView[];
  /** Latest publish or schedule date across targets */
  when: Date | null;
};

/**
 * Publications of the active profile: authored by it or published to it
 * (group publishing). Every query is scoped to the profile / account.
 */
export async function loadHistory(
  profile: Profile,
  filters: { status: HistoryStatusFilter; channel: ContentChannel | "all" },
): Promise<HistoryItem[]> {
  const targeted = db
    .select({ id: contentTargets.contentItemId })
    .from(contentTargets)
    .where(eq(contentTargets.profileId, profile.id));

  const items = await db
    .select({
      id: contentItems.id,
      title: contentItems.title,
      body: contentItems.body,
      imageUrl: contentItems.imageUrl,
      createdAt: contentItems.createdAt,
      status: contentItems.status,
    })
    .from(contentItems)
    .where(
      or(
        eq(contentItems.profileId, profile.id),
        inArray(contentItems.id, targeted),
      ),
    )
    .orderBy(desc(contentItems.createdAt))
    .limit(HISTORY_LIMIT);

  const targets = groupByItem(
    await loadTargetsForItems(
      profile.accountId,
      items.map((item) => item.id),
    ),
  );

  return items
    .map((item) => {
      const list = targets.get(item.id) ?? [];
      const dates = list
        .map((t) => t.publishedAt ?? t.scheduledAt)
        .filter((d): d is Date => Boolean(d))
        .sort((a, b) => b.getTime() - a.getTime());
      return {
        id: item.id,
        title: item.title,
        body: item.body,
        imageUrl: item.imageUrl,
        createdAt: item.createdAt,
        status: contentDisplayStatus(
          item.status,
          list.map((t) => t.status),
        ),
        targets: list,
        when: dates[0] ?? null,
      };
    })
    .filter((item) => matchesStatusFilter(item.status, filters.status))
    .filter(
      (item) =>
        filters.channel === "all" ||
        item.targets.some((t) => t.channel === filters.channel),
    );
}
