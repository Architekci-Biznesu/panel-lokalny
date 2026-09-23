import type { GbpSpecialHourPeriod } from "@/features/wizytowka/types";

export type Holiday = {
  year: number;
  month: number;
  day: number;
  name: string;
};

function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function monthGenitive(month: number): string {
  const names = [
    "stycznia",
    "lutego",
    "marca",
    "kwietnia",
    "maja",
    "czerwca",
    "lipca",
    "sierpnia",
    "września",
    "października",
    "listopada",
    "grudnia",
  ];
  return names[month - 1] ?? "";
}

export function polishHolidaysForYear(year: number): Holiday[] {
  const easter = easterSunday(year);
  const easterMon = addDays(easter, 1);
  const corpus = addDays(easter, 60);
  return [
    { year, month: 1, day: 1, name: "Nowy Rok" },
    { year, month: 1, day: 6, name: "Trzech Króli" },
    {
      year,
      month: easter.getMonth() + 1,
      day: easter.getDate(),
      name: "Wielkanoc",
    },
    {
      year,
      month: easterMon.getMonth() + 1,
      day: easterMon.getDate(),
      name: "Poniedziałek Wielkanocny",
    },
    { year, month: 5, day: 1, name: "Święto Pracy" },
    { year, month: 5, day: 3, name: "Święto Konstytucji 3 Maja" },
    {
      year,
      month: corpus.getMonth() + 1,
      day: corpus.getDate(),
      name: "Boże Ciało",
    },
    { year, month: 8, day: 15, name: "Wniebowzięcie NMP" },
    { year, month: 11, day: 1, name: "Wszystkich Świętych" },
    { year, month: 11, day: 11, name: "Święto Niepodległości" },
    { year, month: 12, day: 24, name: "Wigilia" },
    { year, month: 12, day: 25, name: "Boże Narodzenie" },
    { year, month: 12, day: 26, name: "Drugi dzień Bożego Narodzenia" },
  ];
}

export function holidayNameFor(parts: {
  year: number;
  month: number;
  day: number;
}): string | null {
  return (
    polishHolidaysForYear(parts.year).find(
      (h) => h.month === parts.month && h.day === parts.day,
    )?.name ?? null
  );
}

function warsawToday(): Date {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Warsaw",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? "";
  return new Date(
    Number(get("year")),
    Number(get("month")) - 1,
    Number(get("day")),
  );
}

function specialDateParts(date?: {
  year?: number;
  month?: number;
  day?: number;
}): { year: number; month: number; day: number } | null {
  if (!date?.year || !date?.month || !date?.day) return null;
  return { year: date.year, month: date.month, day: date.day };
}

/** Next holiday labels when no upcoming special hours are set. */
export function getUpcomingHolidayHint(
  special: GbpSpecialHourPeriod[],
): string | null {
  const today = warsawToday();
  const hasUpcomingSpecial = special.some((p) => {
    const d = specialDateParts(p.startDate);
    if (!d) return false;
    return new Date(d.year, d.month - 1, d.day) >= today;
  });
  if (hasUpcomingSpecial) return null;

  const year = today.getFullYear();
  const holidays = [
    ...polishHolidaysForYear(year),
    ...polishHolidaysForYear(year + 1),
  ]
    .map((h) => ({ ...h, date: new Date(h.year, h.month - 1, h.day) }))
    .filter((h) => h.date >= today)
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  const labels: string[] = [];
  let i = 0;
  while (i < holidays.length && labels.length < 3) {
    const h = holidays[i];
    if (h.month === 12 && h.day === 24) {
      labels.push("24-26 grudnia");
      while (
        i < holidays.length &&
        holidays[i].month === 12 &&
        holidays[i].day >= 24 &&
        holidays[i].day <= 26
      ) {
        i += 1;
      }
      continue;
    }
    if (h.month === 12 && h.day >= 25 && h.day <= 26) {
      i += 1;
      continue;
    }
    labels.push(`${h.day} ${monthGenitive(h.month)}`);
    i += 1;
  }

  return labels.length ? labels.join(", ") : null;
}
