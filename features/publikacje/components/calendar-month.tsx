import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { CHANNEL_LABELS } from "@/features/publikacje/content-status";
import {
  CalendarViewToggle,
  StatusIcon,
  TIME_FMT,
  dayKey,
  statusTone,
  warsawDayKey,
} from "@/features/publikacje/components/calendar-parts";
import {
  monthGrid,
  monthParam,
  shiftMonth,
  type CalendarEntry,
  type CalendarMonth as Month,
} from "@/features/publikacje/load-calendar";

const WEEKDAYS = ["Pon", "Wt", "Śr", "Czw", "Pt", "Sob", "Nd"];

const MONTH_FMT = new Intl.DateTimeFormat("pl-PL", {
  month: "long",
  year: "numeric",
});

/** Posts shown in a day cell; the rest as "+N więcej". */
const PER_DAY = 2;

function countLabel(n: number, one: string, few: string, many: string) {
  if (n === 1) return one;
  const last = n % 10;
  const lastTwo = n % 100;
  return last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14) ? few : many;
}

/**
 * Month view: 7 columns, posts as small text cards (status icon, time,
 * title) - no images here, those are in the "Tygodnie" view.
 */
export function CalendarMonth({
  month,
  entries,
}: {
  month: Month;
  entries: CalendarEntry[];
}) {
  const byDay = new Map<string, CalendarEntry[]>();
  for (const entry of entries) {
    const key = warsawDayKey(entry.date);
    byDay.set(key, [...(byDay.get(key) ?? []), entry]);
  }
  const today = warsawDayKey(new Date());
  const label = MONTH_FMT.format(new Date(month.year, month.month - 1, 1));

  const counts = { published: 0, failed: 0, scheduled: 0 };
  for (const entry of entries) counts[statusTone(entry.status)] += 1;

  return (
    <section className="pub-cal">
      <header className="pub-cal-head">
        <h2 className="pub-cal-title">{label}</h2>
        <div className="pub-cal-nav">
          <Link
            href={`/publikacje/kalendarz?m=${monthParam(shiftMonth(month, -1))}`}
            className="ui-btn ui-btn-secondary ui-btn-sm pub-cal-arrow"
            aria-label="Poprzedni miesiąc"
          >
            <ChevronLeft aria-hidden />
          </Link>
          <Link
            href="/publikacje/kalendarz"
            className="ui-btn ui-btn-secondary ui-btn-sm"
          >
            Dziś
          </Link>
          <Link
            href={`/publikacje/kalendarz?m=${monthParam(shiftMonth(month, 1))}`}
            className="ui-btn ui-btn-secondary ui-btn-sm pub-cal-arrow"
            aria-label="Następny miesiąc"
          >
            <ChevronRight aria-hidden />
          </Link>
        </div>
        <div className="pub-cal-tools">
          <ul className="pub-cal-stats" aria-label="Podsumowanie miesiąca">
            <li className="pub-cal-stat is-published">
              <span className="mono">{counts.published}</span>
              {countLabel(
                counts.published,
                "opublikowany",
                "opublikowane",
                "opublikowanych",
              )}
            </li>
            {counts.failed ? (
              <li className="pub-cal-stat is-failed">
                <span className="mono">{counts.failed}</span>
                {countLabel(counts.failed, "błąd", "błędy", "błędów")}
              </li>
            ) : null}
            <li className="pub-cal-stat is-scheduled">
              <span className="mono">{counts.scheduled}</span>
              {countLabel(
                counts.scheduled,
                "zaplanowany",
                "zaplanowane",
                "zaplanowanych",
              )}
            </li>
          </ul>
          <CalendarViewToggle active="kalendarz" />
        </div>
      </header>

      <div className="pub-cal-grid">
        {WEEKDAYS.map((day) => (
          <span key={day} className="pub-cal-weekday">
            {day}
          </span>
        ))}
        {monthGrid(month).map(({ date, inMonth }) => {
          const key = dayKey(date);
          const list = byDay.get(key) ?? [];
          const isToday = key === today;
          const weekend = date.getDay() === 0 || date.getDay() === 6;
          return (
            <div
              key={key}
              className={`pub-cal-day${inMonth ? "" : " is-out"}${weekend ? " is-weekend" : ""}${isToday ? " is-today" : ""}`}
            >
              <div className="pub-cal-day-head">
                <span className="pub-cal-date mono">{date.getDate()}</span>
                {isToday ? <span className="pub-cal-today">Dziś</span> : null}
              </div>
              {list.slice(0, PER_DAY).map((entry) => (
                <Link
                  key={entry.targetId}
                  href="/publikacje?status=all"
                  className={`pub-cal-entry is-${statusTone(entry.status)}`}
                  title={`${CHANNEL_LABELS[entry.channel]} · ${entry.title}`}
                >
                  <span className="pub-cal-entry-time">
                    <StatusIcon status={entry.status} />
                    <span className="mono">{TIME_FMT.format(entry.date)}</span>
                  </span>
                  <span className="pub-cal-entry-title">{entry.title}</span>
                </Link>
              ))}
              {list.length > PER_DAY ? (
                <Link href="/publikacje?status=all" className="pub-cal-more">
                  +{list.length - PER_DAY} więcej
                </Link>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
