import { and, asc, count, desc, eq, gte, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  contentGenerationRuns,
  contentItems,
  contentRevisions,
  contentChannelEnum,
  type ContentChannel,
  type Profile,
} from "@/lib/db/schema";
import { isChannelAvailable } from "@/lib/integrations/publishers";
import { listAccountProfileOptions } from "@/lib/session";
import { groupSiblings } from "@/features/publikacje/group-targets";
import type { GenerationStatus } from "@/features/publikacje/actions";
import {
  loadContentScope,
  ownedByScope,
  runsInScope,
} from "@/features/publikacje/scope";

export type InboxItem = {
  id: string;
  title: string;
  body: string;
  imageUrl: string | null;
  createdAt: Date;
  revisionCount: number;
  /** Requests that changed this post in the chat, oldest first (last 5) */
  recentInstructions: string[];
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

export async function countPendingContent(profile: Profile): Promise<number> {
  const scope = await loadContentScope(profile);
  const [row] = await db
    .select({ value: count() })
    .from(contentItems)
    .where(and(ownedByScope(scope), eq(contentItems.status, "pending")));
  return row?.value ?? 0;
}

export async function loadInbox(profile: Profile): Promise<InboxData> {
  const scope = await loadContentScope(profile);
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
    .where(and(ownedByScope(scope), eq(contentItems.status, "pending")))
    .groupBy(contentItems.id)
    .orderBy(desc(contentItems.createdAt));

  const history = rows.length
    ? await db
        .select({
          contentItemId: contentRevisions.contentItemId,
          instruction: contentRevisions.instruction,
        })
        .from(contentRevisions)
        .where(
          inArray(
            contentRevisions.contentItemId,
            rows.map((row) => row.id),
          ),
        )
        .orderBy(asc(contentRevisions.createdAt))
    : [];
  const byItem = new Map<string, string[]>();
  for (const row of history) {
    byItem.set(row.contentItemId, [
      ...(byItem.get(row.contentItemId) ?? []),
      row.instruction,
    ]);
  }

  const options = await listAccountProfileOptions();
  const siblings = groupSiblings(profile.id, options);
  const own = options.find((option) => option.id === profile.id);

  return {
    items: rows.map((row) => ({
      ...row,
      recentInstructions: (byItem.get(row.id) ?? []).slice(-5),
    })),
    channels: contentChannelEnum.enumValues.map((channel) => ({
      channel,
      available: isChannelAvailable(channel),
    })),
    groupSiblings: siblings.map(({ id, name }) => ({ id, name })),
    groupName: siblings.length ? (own?.groupName ?? null) : null,
  };
}

/** Background generation runs still writing posts for this profile / group. */
export async function loadActiveRuns(
  profile: Profile,
): Promise<GenerationStatus[]> {
  const scope = await loadContentScope(profile);
  return db
    .select({
      id: contentGenerationRuns.id,
      status: contentGenerationRuns.status,
      requested: contentGenerationRuns.requested,
      created: contentGenerationRuns.created,
      error: contentGenerationRuns.error,
    })
    .from(contentGenerationRuns)
    .where(
      and(
        runsInScope(scope),
        eq(contentGenerationRuns.status, "running"),
        gte(contentGenerationRuns.startedAt, new Date(Date.now() - 3_600_000)),
      ),
    );
}
