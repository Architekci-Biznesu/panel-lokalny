import { and, asc, desc, eq, gt, gte, inArray } from "drizzle-orm";
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
  imageUrl: string | null;
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
      imageUrl: contentItems.imageUrl,
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

/** Weeks shown in the Pulpit rhythm: the current one and the 7 before it. */
export const RHYTHM_WEEKS = 8;

const WARSAW_DAY = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Warsaw",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Monday (y-m-d, Warsaw) of the week the moment falls in. */
export function warsawWeekKey(date: Date): string {
  const [year, month, day] = WARSAW_DAY.format(date).split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day));
  utc.setUTCDate(utc.getUTCDate() - ((utc.getUTCDay() + 6) % 7));
  return utc.toISOString().slice(0, 10);
}

export type PublishingRhythm = {
  /** Oldest first; the last one is the current week */
  weeks: Array<{ start: string; published: boolean }>;
  /** The nearest post waiting to go out (scheduled or queued) */
  next: { targetId: string; title: string; date: Date | null } | null;
};

/** Pulpit: which of the last weeks had a published post, and what goes out next. */
export async function loadPublishingRhythm(
  profile: Profile,
  now: Date = new Date(),
): Promise<PublishingRhythm> {
  const current = warsawWeekKey(now);
  const starts = Array.from({ length: RHYTHM_WEEKS }, (_, index) => {
    const date = new Date(`${current}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() - (RHYTHM_WEEKS - 1 - index) * 7);
    return date.toISOString().slice(0, 10);
  });
  // A day of margin covers the time zone at the start of the oldest week.
  const since = new Date(`${starts[0]}T00:00:00Z`);
  since.setUTCDate(since.getUTCDate() - 1);

  const [published, upcoming] = await Promise.all([
    db
      .select({ publishedAt: contentTargets.publishedAt })
      .from(contentTargets)
      .where(
        and(
          eq(contentTargets.profileId, profile.id),
          eq(contentTargets.status, "published"),
          gte(contentTargets.publishedAt, since),
        ),
      ),
    db
      .select({
        targetId: contentTargets.id,
        title: contentItems.title,
        date: contentTargets.scheduledAt,
      })
      .from(contentTargets)
      .innerJoin(
        contentItems,
        eq(contentItems.id, contentTargets.contentItemId),
      )
      .where(
        and(
          eq(contentTargets.profileId, profile.id),
          inArray(contentTargets.status, ["queued", "scheduled"]),
          gt(contentTargets.scheduledAt, now),
        ),
      )
      .orderBy(asc(contentTargets.scheduledAt))
      .limit(1),
  ]);

  const withPost = new Set(
    published.flatMap((row) =>
      row.publishedAt ? [warsawWeekKey(row.publishedAt)] : [],
    ),
  );
  return {
    weeks: starts.map((start) => ({ start, published: withPost.has(start) })),
    next: upcoming[0] ?? null,
  };
}
