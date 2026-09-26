import type { GbpPeriod, GbpTimeOfDay } from "@/features/wizytowka/types";

const WEEKDAY_KEYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

const GBP_DAY_INDEX: Record<string, number> = {
  MONDAY: 0,
  TUESDAY: 1,
  WEDNESDAY: 2,
  THURSDAY: 3,
  FRIDAY: 4,
  SATURDAY: 5,
  SUNDAY: 6,
};

function timeToMinutes(t?: GbpTimeOfDay): number | null {
  if (t?.hours === undefined || !Number.isFinite(t.hours)) return null;
  const minutes = t.minutes ?? 0;
  if (!Number.isFinite(minutes)) return null;
  return t.hours * 60 + minutes;
}

/** Minutes open across a GBP regularHours period (supports overnight). */
export function gbpPeriodOpenMinutes(period: GbpPeriod): number {
  const openDay = period.openDay ? GBP_DAY_INDEX[period.openDay] : undefined;
  const closeDay = period.closeDay
    ? GBP_DAY_INDEX[period.closeDay]
    : openDay;
  const open = timeToMinutes(period.openTime);
  const close = timeToMinutes(period.closeTime);
  if (openDay === undefined || closeDay === undefined) return 0;
  if (open == null || close == null) return 0;

  if (openDay === closeDay) {
    if (close >= open) return close - open;
    // Same-day wrap (rare) → treat as overnight into next calendar day.
    return 24 * 60 - open + close;
  }

  let days = (closeDay - openDay + 7) % 7;
  if (days === 0) days = 7;
  return days * 24 * 60 - open + close;
}

/** Total weekly open minutes from GBP regularHours periods. */
export function weeklyMinutesFromGbpPeriods(
  periods: GbpPeriod[] | null | undefined,
): number {
  if (!periods?.length) return 0;
  return periods.reduce((sum, period) => sum + gbpPeriodOpenMinutes(period), 0);
}

function parseClockToMinutes(
  raw: string,
  impliedMeridiem?: "am" | "pm" | null,
): number | null {
  const cleaned = raw
    .trim()
    .toLowerCase()
    .replace(/\./g, ":")
    .replace(/\s+/g, " ");
  const match =
    /^(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?$/.exec(cleaned);
  if (!match) return null;
  let hours = Number(match[1]);
  const minutes = match[2] ? Number(match[2]) : 0;
  let meridiem =
    (match[3]?.replace(/\./g, "") as "am" | "pm" | undefined) ??
    impliedMeridiem ??
    null;
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  if (minutes < 0 || minutes > 59 || hours < 0 || hours > 24) return null;

  if (meridiem === "am" || meridiem === "pm") {
    if (hours === 12) hours = 0;
    if (meridiem === "pm") hours += 12;
  }
  if (hours === 24 && minutes === 0) return 24 * 60;
  if (hours > 23) return null;
  return hours * 60 + minutes;
}

function parseRangeMinutes(part: string): number | null {
  const range = part
    .split(/\s*[–—−\-]+\s*/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (range.length < 2) return null;

  const openRaw = range[0]!;
  const closeRaw = range[1]!;
  const closeMeridiemMatch =
    /\b(am|pm|a\.m\.|p\.m\.)\s*$/i.exec(closeRaw)?.[1]?.replace(/\./g, "").toLowerCase() as
      | "am"
      | "pm"
      | undefined;
  const openHasMeridiem = /\b(am|pm|a\.m\.|p\.m\.)\s*$/i.test(openRaw);

  let impliedOpen: "am" | "pm" | null = null;
  if (!openHasMeridiem && closeMeridiemMatch) {
    const openHour = Number(/^(\d{1,2})/.exec(openRaw)?.[1] ?? NaN);
    const closeHour = Number(/^(\d{1,2})/.exec(closeRaw)?.[1] ?? NaN);
    // "9–5 PM" → open AM; "2–6 PM" → both PM
    if (
      closeMeridiemMatch === "pm" &&
      Number.isFinite(openHour) &&
      Number.isFinite(closeHour) &&
      openHour > closeHour
    ) {
      impliedOpen = "am";
    } else {
      impliedOpen = closeMeridiemMatch;
    }
  }

  const open = parseClockToMinutes(openRaw, impliedOpen);
  const close = parseClockToMinutes(closeRaw);
  if (open == null || close == null) return null;
  if (close >= open) return close - open;
  return 24 * 60 - open + close;
}

/**
 * Minutes open for one day string from ScrapingDog / Maps.
 * Returns null when the string cannot be interpreted.
 */
export function dayOpenMinutesFromLabel(raw: string): number | null {
  const text = raw.trim();
  if (!text) return null;
  const lower = text.toLowerCase();

  if (
    /^(closed|zamkni[eę]te|nieczynne)\b/.test(lower) ||
    lower === "closed" ||
    lower === "zamknięte"
  ) {
    return 0;
  }

  if (
    /24\s*(h|hr|hrs|hours|godz)/i.test(text) ||
    /ca[lł][aą]\s*dob[eę]/i.test(text) ||
    /open\s*24/i.test(text)
  ) {
    return 24 * 60;
  }

  // Split multi-range days: "9 AM–12 PM, 2–6 PM"
  const parts = text.split(/\s*(?:,|;|\/)\s*/).filter(Boolean);
  let total = 0;
  let parsedAny = false;

  for (const part of parts) {
    const minutes = parseRangeMinutes(part);
    if (minutes == null) continue;
    parsedAny = true;
    total += minutes;
  }

  return parsedAny ? total : null;
}

/** Sum weekly minutes from ScrapingDog operating_hours map. */
export function weeklyMinutesFromOperatingHours(
  hours: Record<string, string> | null | undefined,
): number | null {
  if (!hours) return null;
  let total = 0;
  let parsedDays = 0;
  for (const key of WEEKDAY_KEYS) {
    const label =
      hours[key] ??
      hours[key.slice(0, 3)] ??
      hours[`${key[0]!.toUpperCase()}${key.slice(1)}`];
    if (typeof label !== "string") continue;
    const minutes = dayOpenMinutesFromLabel(label);
    if (minutes == null) continue;
    total += minutes;
    parsedDays += 1;
  }
  // Need most of the week to compare fairly.
  if (parsedDays < 5) return null;
  return total;
}

export function formatWeeklyHoursLabel(minutes: number): string {
  const hours = Math.round(minutes / 60);
  return `${hours} h`;
}
