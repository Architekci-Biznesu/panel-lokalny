import { WEEKDAYS, type GbpPeriod } from "@/features/wizytowka/types";

/**
 * Opening hours per day as people read them. Google returns hours past
 * midnight split at 00:00 - "Sunday 09:00-04:00" comes as Sunday 09:00-24:00
 * plus Monday 00:00-04:00 (midnight as an empty time). Here the pieces are
 * joined back: the range belongs to the day it opens, and closes after
 * midnight. Pure - used by the hours list and the hours editor.
 */

export type DayRange = { open: string; close: string };

type Day = (typeof WEEKDAYS)[number]["value"];

const DAYS = WEEKDAYS.map((d) => d.value) as Day[];

function minutes(t?: { hours?: number; minutes?: number }): number {
  return (t?.hours ?? 0) * 60 + (t?.minutes ?? 0);
}

function hhmm(total: number): string {
  const value = ((total % 1440) + 1440) % 1440;
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
}

function nextDay(day: Day): Day {
  return DAYS[(DAYS.indexOf(day) + 1) % DAYS.length];
}

/** Ranges per day (Monday first), overnight pieces joined. */
export function rangesByDay(periods: GbpPeriod[]): Record<Day, DayRange[]> {
  const pieces = periods
    .filter((p) => DAYS.includes(p.openDay as Day))
    .map((p) => {
      const openDay = p.openDay as Day;
      const start = minutes(p.openTime);
      // A close on a later day (closeDay set) is a real overnight period.
      let end = minutes(p.closeTime);
      if (p.closeDay && p.closeDay !== p.openDay) end += 1440;
      else if (end <= start) end += 1440;
      return { day: openDay, start, end };
    });

  const byDay = Object.fromEntries(
    DAYS.map((d) => [d, [] as DayRange[]]),
  ) as Record<Day, DayRange[]>;
  const used = new Set<number>();

  // Pieces starting at 00:00 last - first the previous day may take them.
  const order = pieces
    .map((_, index) => index)
    .sort(
      (a, b) => Number(pieces[a].start === 0) - Number(pieces[b].start === 0),
    );

  order.forEach((index) => {
    const piece = pieces[index];
    if (used.has(index)) return;
    let end = piece.end;
    // Ends at midnight: take the next day's piece that starts at 00:00.
    if (end === 1440) {
      const carry = pieces.findIndex(
        (other, i) =>
          !used.has(i) &&
          i !== index &&
          other.day === nextDay(piece.day) &&
          other.start === 0,
      );
      if (carry >= 0) {
        used.add(carry);
        end = 1440 + pieces[carry].end;
      }
    }
    used.add(index);
    byDay[piece.day].push({ open: hhmm(piece.start), close: hhmm(end) });
  });

  for (const day of DAYS) {
    byDay[day].sort((a, b) => a.open.localeCompare(b.open));
  }
  return byDay;
}

/** "09:00-04:00, 13:00-00:00" - like Google shows it. */
export function formatDayRanges(ranges: DayRange[]): string {
  return ranges.map((r) => `${r.open}-${r.close}`).join(", ");
}

/**
 * Editor row -> Google period. A close at or before the open is the next
 * day (overnight); a close at midnight is 24:00 of the same day, as Google
 * writes it.
 */
export function periodFromRange(
  day: Day,
  open: string,
  close: string,
): { openDay: Day; closeDay: Day; openTime: string; closeTime: string } {
  if (close === "00:00") {
    return { openDay: day, closeDay: day, openTime: open, closeTime: "24:00" };
  }
  return {
    openDay: day,
    closeDay: close <= open ? nextDay(day) : day,
    openTime: open,
    closeTime: close,
  };
}
