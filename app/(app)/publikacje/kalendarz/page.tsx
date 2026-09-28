import { CalendarMonth } from "@/features/publikacje/components/calendar-month";
import {
  loadCalendar,
  parseCalendarMonth,
} from "@/features/publikacje/load-calendar";
import { getActiveProfile } from "@/lib/session";

export default async function PublikacjeKalendarzPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string }>;
}) {
  const month = parseCalendarMonth((await searchParams).m);
  const profile = await getActiveProfile();
  const entries = await loadCalendar(profile, month);

  return <CalendarMonth month={month} entries={entries} />;
}
