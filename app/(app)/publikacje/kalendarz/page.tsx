import { CalendarMonth } from "@/features/publikacje/components/calendar-month";
import {
  CalendarWeeks,
  WEEKS_SHOWN,
} from "@/features/publikacje/components/calendar-weeks";
import {
  addDays,
  dayParam,
  loadCalendar,
  loadCalendarRange,
  parseCalendarMonth,
  parseWeekParam,
} from "@/features/publikacje/load-calendar";
import { getActiveProfile } from "@/lib/session";

export default async function PublikacjeKalendarzPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string; t?: string; widok?: string }>;
}) {
  const params = await searchParams;
  const profile = await getActiveProfile();

  if (params.widok === "tygodnie") {
    // The previous week for context, then the current one and the next ones.
    const first = addDays(parseWeekParam(params.t), -7);
    const entries = await loadCalendarRange(
      profile,
      dayParam(first),
      dayParam(addDays(first, WEEKS_SHOWN * 7)),
    );
    return <CalendarWeeks first={first} entries={entries} />;
  }

  const month = parseCalendarMonth(params.m);
  const entries = await loadCalendar(profile, month);
  return <CalendarMonth month={month} entries={entries} />;
}
