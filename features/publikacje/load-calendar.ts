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
  /** Post image (the "Tygodnie" view shows it; the month view does not) */
  imageUrl: string | null;
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
 * Grid of days (Monday first) covering the month - 5 or 6 full weeks, only as
 * many as the month needs. `inMonth` marks days of the displayed month.
 */
export function monthGrid(
  value: CalendarMonth,
): Array<{ date: Date; inMonth: boolean }> {
  const first = new Date(value.year, value.month - 1, 1);
  const offset = (first.getDay() + 6) % 7;
  const start = new Date(value.year, value.month - 1, 1 - offset);
  const days = new Date(value.year, value.month, 0).getDate();
  const weeks = Math.ceil((offset + days) / 7);
  return Array.from({ length: weeks * 7 }, (_, i) => {
    const date = new Date(
      start.getFullYear(),
      start.getMonth(),
      start.getDate() + i,
    );
    return { date, inMonth: date.getMonth() === value.month - 1 };
  });
}

/** Monday (local midnight) of the week that contains `date`. */
export function weekStart(date: Date): Date {
  const offset = (date.getDay() + 6) % 7;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() - offset);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

/** `?t=2026-09-28` -> Monday of that week, defaulting to the current week. */
export function parseWeekParam(value: unknown, now: Date = new Date()): Date {
  const match =
    typeof value === "string" && /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match) {
    const date = new Date(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3]),
    );
    if (!Number.isNaN(date.getTime()) && date.getFullYear() >= 2020) {
      return weekStart(date);
    }
  }
  return weekStart(now);
}

export function dayParam(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** Targets of the active profile in the month (see loadCalendarRange). */
export function loadCalendar(
  profile: Profile,
  value: CalendarMonth,
): Promise<CalendarEntry[]> {
  return loadCalendarRange(
    profile,
    `${monthParam(value)}-01`,
    `${monthParam(shiftMonth(value, 1))}-01`,
  );
}

/**
 * Targets of the active profile between two Warsaw calendar days
 * ("YYYY-MM-DD", `to` exclusive), by scheduled_at (published posts without a
 * schedule fall back to published_at, so the view is not empty).
 */
export async function loadCalendarRange(
  profile: Profile,
  from: string,
  to: string,
): Promise<CalendarEntry[]> {
  // Bounds as Warsaw calendar days, compared in the database: a raw SQL
  // expression has no column type, so JS Dates would be sent as unreadable text.
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
      imageUrl: contentItems.imageUrl,
    })
    .from(contentTargets)
    .innerJoin(contentItems, eq(contentItems.id, contentTargets.contentItemId))
    .where(
      and(
        eq(contentTargets.profileId, profile.id),
        sql`${warsawDay} >= ${from}::timestamp`,
        sql`${warsawDay} < ${to}::timestamp`,
      ),
    )
    .orderBy(day);

  return rows.map((row) => ({ ...row, date: new Date(row.date) }));
}
