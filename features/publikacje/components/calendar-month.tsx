import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { CHANNEL_LABELS } from "@/features/publikacje/content-status";
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

const TIME_FMT = new Intl.DateTimeFormat("pl-PL", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Warsaw",
});

const WARSAW_DAY = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Warsaw",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Grid cells are calendar days (local y-m-d). */
function dayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** Publications are placed on their Warsaw day, whatever the server time zone. */
function warsawDayKey(date: Date): string {
  return WARSAW_DAY.format(date);
}

/** Simple month view: 7 columns, publications on their day. No drag and drop. */
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

  return (
    <section className="ui-section pub-cal">
      <header className="pub-cal-head">
        <h2 className="pub-cal-title">{label}</h2>
        <div className="pub-cal-nav">
          <Link
            href={`/publikacje/kalendarz?m=${monthParam(shiftMonth(month, -1))}`}
            className="ui-btn ui-btn-white ui-btn-sm"
            aria-label="Poprzedni miesiąc"
          >
            <ChevronLeft aria-hidden />
          </Link>
          <Link
            href="/publikacje/kalendarz"
            className="ui-btn ui-btn-white ui-btn-sm"
          >
            Dziś
          </Link>
          <Link
            href={`/publikacje/kalendarz?m=${monthParam(shiftMonth(month, 1))}`}
            className="ui-btn ui-btn-white ui-btn-sm"
            aria-label="Następny miesiąc"
          >
            <ChevronRight aria-hidden />
          </Link>
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
          return (
            <div
              key={key}
              className={`pub-cal-day${inMonth ? "" : " is-out"}${key === today ? " is-today" : ""}`}
            >
              <span className="pub-cal-date mono">{date.getDate()}</span>
              {list.map((entry) => (
                <Link
                  key={entry.targetId}
                  href="/publikacje?status=all"
                  className={`pub-cal-entry is-${entry.status}`}
                  title={`${CHANNEL_LABELS[entry.channel]} · ${entry.title}`}
                >
                  <span className="mono">{TIME_FMT.format(entry.date)}</span>{" "}
                  {entry.title}
                </Link>
              ))}
            </div>
          );
        })}
      </div>

      <div className="pub-cal-legend">
        <span className="pub-cal-key is-scheduled">Zaplanowane</span>
        <span className="pub-cal-key is-published">Opublikowane</span>
        <span className="pub-cal-key is-failed">Błąd</span>
      </div>
    </section>
  );
}
