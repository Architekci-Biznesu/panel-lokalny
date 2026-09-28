import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  contentItems,
  contentTargets,
  type ContentChannel,
  type ContentTargetStatus,
  type Profile,
} from "@/lib/db/schema";

export type CalendarEntry = {
  targetId: string;
  itemId: string;
  title: string;
  channel: ContentChannel;
  status: ContentTargetStatus;
  date: Date;
};

export type CalendarMonth = { year: number; month: number };

/** `?m=2026-10` -> { year, month }, defaulting to the current month. */
export function parseCalendarMonth(
  value: unknown,
  now: Date = new Date(),
): CalendarMonth {
  const match = typeof value === "string" && /^(\d{4})-(\d{2})$/.exec(value);
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]);
    if (year >= 2020 && year <= 2100 && month >= 1 && month <= 12) {
      return { year, month };
    }
  }
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

export function shiftMonth(value: CalendarMonth, delta: number): CalendarMonth {
  const date = new Date(value.year, value.month - 1 + delta, 1);
  return { year: date.getFullYear(), month: date.getMonth() + 1 };
}

export function monthParam(value: CalendarMonth): string {
  return `${value.year}-${String(value.month).padStart(2, "0")}`;
}

/**
 * 6x7 grid of days (Monday first) covering the month.
 * `inMonth` marks days belonging to the displayed month.
 */
export function monthGrid(
  value: CalendarMonth,
): Array<{ date: Date; inMonth: boolean }> {
  const first = new Date(value.year, value.month - 1, 1);
  const offset = (first.getDay() + 6) % 7;
  const start = new Date(value.year, value.month - 1, 1 - offset);
  return Array.from({ length: 42 }, (_, i) => {
    const date = new Date(
      start.getFullYear(),
      start.getMonth(),
      start.getDate() + i,
    );
    return { date, inMonth: date.getMonth() === value.month - 1 };
  });
}

/**
 * Targets of the active profile in the month, by scheduled_at (published
 * posts without a schedule fall back to published_at, so the month is not empty).
 */
export async function loadCalendar(
  profile: Profile,
  value: CalendarMonth,
): Promise<CalendarEntry[]> {
  // Month bounds as Warsaw calendar days, compared in the database: a raw SQL
  // expression has no column type, so JS Dates would be sent as unreadable text.
  const from = monthParam(value);
  const to = monthParam(shiftMonth(value, 1));
  const day = sql<Date>`coalesce(${contentTargets.scheduledAt}, ${contentTargets.publishedAt})`;
  const warsawDay = sql`(${day} at time zone 'Europe/Warsaw')`;

  const rows = await db
    .select({
      targetId: contentTargets.id,
      itemId: contentItems.id,
      title: contentItems.title,
      channel: contentTargets.channel,
      status: contentTargets.status,
      date: day,
    })
    .from(contentTargets)
    .innerJoin(contentItems, eq(contentItems.id, contentTargets.contentItemId))
    .where(
      and(
        eq(contentTargets.profileId, profile.id),
        sql`${warsawDay} >= ${`${from}-01`}::timestamp`,
        sql`${warsawDay} < ${`${to}-01`}::timestamp`,
      ),
    )
    .orderBy(day);

  return rows.map((row) => ({ ...row, date: new Date(row.date) }));
}
