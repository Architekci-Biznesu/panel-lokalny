import { ChevronLeft, ChevronRight, ImageIcon, Plus } from "lucide-react";
import Link from "next/link";
import { ScheduledPostMenu } from "@/features/publikacje/components/scheduled-post-menu";
import { TargetStatusPill } from "@/features/publikacje/components/content-status-pill";
import { TopicsButton } from "@/features/publikacje/components/topics-button";
import {
  CalendarViewToggle,
  TIME_FMT,
  dayKey,
  statusTone,
  warsawDayKey,
} from "@/features/publikacje/components/calendar-parts";
import { CHANNEL_LABELS } from "@/features/publikacje/content-status";
import {
  addDays,
  dayParam,
  weekStart,
  type CalendarEntry,
} from "@/features/publikacje/load-calendar";

/** Previous week + the current one + 3 ahead. */
export const WEEKS_SHOWN = 5;

const DAY_FMT = new Intl.DateTimeFormat("pl-PL", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "Europe/Warsaw",
});

const RANGE_FMT = new Intl.DateTimeFormat("pl-PL", {
  day: "numeric",
  month: "short",
});

function postsLabel(n: number): string {
  if (n === 1) return "1 post";
  const last = n % 10;
  const lastTwo = n % 100;
  return `${n} ${last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14) ? "posty" : "postów"}`;
}

function WeekCard({ entry }: { entry: CalendarEntry }) {
  const tone = statusTone(entry.status);
  const inner = (
    <>
      <span className="pub-week-card-media">
        {entry.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- public R2 URL, domain set per environment
          <img src={entry.imageUrl} alt="" />
        ) : (
          <ImageIcon aria-hidden />
        )}
        <span className="pub-week-card-status">
          <TargetStatusPill status={entry.status} />
        </span>
      </span>
      <span className="pub-week-card-body">
        <span className="pub-week-card-when">
          {DAY_FMT.format(entry.date)} ·{" "}
          <span className="mono">{TIME_FMT.format(entry.date)}</span>
        </span>
        <span className="pub-week-card-title">{entry.title}</span>
      </span>
    </>
  );

  // A scheduled post opens its menu (new date / cancel) in place.
  if (entry.status === "scheduled") {
    return (
      <ScheduledPostMenu
        itemId={entry.itemId}
        title={entry.title}
        scheduledAt={entry.date.toISOString()}
        imageUrl={entry.imageUrl}
        channelLabel={CHANNEL_LABELS[entry.channel]}
        triggerClassName={`pub-week-card is-${tone}`}
        triggerLabel={`${entry.title} - zmień termin albo anuluj`}
      >
        {inner}
      </ScheduledPostMenu>
    );
  }

  return (
    <Link
      href="/publikacje?status=all"
      className={`pub-week-card is-${tone}`}
      title={`${CHANNEL_LABELS[entry.channel]} · ${entry.title}`}
    >
      {inner}
    </Link>
  );
}

/**
 * "Tygodnie": one row per week with post cards (image, status, day, time).
 * A week without a post shows an empty slot - Google rewards regular posts.
 */
export function CalendarWeeks({
  first,
  entries,
}: {
  /** Monday of the first (previous) week shown */
  first: Date;
  entries: CalendarEntry[];
}) {
  const todayKey = warsawDayKey(new Date());
  const current = weekStart(new Date());
  // Navigation moves the "current" (second) week by 4 weeks.
  const anchor = addDays(first, 7);
  const prev = dayParam(addDays(anchor, -28));
  const next = dayParam(addDays(anchor, 28));
  const last = addDays(first, WEEKS_SHOWN * 7 - 1);

  const weeks = Array.from({ length: WEEKS_SHOWN }, (_, i) => {
    const start = addDays(first, i * 7);
    const days = new Set(
      Array.from({ length: 7 }, (_, d) => dayKey(addDays(start, d))),
    );
    return {
      start,
      end: addDays(start, 6),
      items: entries.filter((e) => days.has(warsawDayKey(e.date))),
      isCurrent: dayKey(start) === dayKey(current),
      isPast: dayKey(addDays(start, 6)) < todayKey,
    };
  });

  return (
    <section className="pub-cal">
      <header className="pub-cal-head">
        <h2 className="pub-cal-title">
          {RANGE_FMT.format(first)} - {RANGE_FMT.format(last)}
        </h2>
        <div className="pub-cal-nav">
          <Link
            href={`/publikacje/kalendarz?widok=tygodnie&t=${prev}`}
            className="ui-btn ui-btn-secondary ui-btn-sm pub-cal-arrow"
            aria-label="Wcześniejsze tygodnie"
          >
            <ChevronLeft aria-hidden />
          </Link>
          <Link
            href="/publikacje/kalendarz?widok=tygodnie"
            className="ui-btn ui-btn-secondary ui-btn-sm"
          >
            Dziś
          </Link>
          <Link
            href={`/publikacje/kalendarz?widok=tygodnie&t=${next}`}
            className="ui-btn ui-btn-secondary ui-btn-sm pub-cal-arrow"
            aria-label="Kolejne tygodnie"
          >
            <ChevronRight aria-hidden />
          </Link>
        </div>
        <div className="pub-cal-tools">
          <span className="pub-cal-goal">cel: 1 post tygodniowo w Google</span>
          <CalendarViewToggle active="tygodnie" />
        </div>
      </header>

      <ol className="pub-weeks">
        {weeks.map((week) => {
          const label = week.isCurrent
            ? "Ten tydzień"
            : dayKey(week.start) === dayKey(addDays(current, 7))
              ? "Następny tydzień"
              : dayKey(week.start) === dayKey(addDays(current, -7))
                ? "Poprzedni tydzień"
                : null;
          const count = week.items.length;
          return (
            <li
              key={dayKey(week.start)}
              className={`pub-week${week.isCurrent ? " is-current" : ""}${week.isPast ? " is-past" : ""}`}
            >
              <div className="pub-week-info">
                {label ? <span className="pub-week-label">{label}</span> : null}
                <span className="pub-week-range">
                  {RANGE_FMT.format(week.start)} - {RANGE_FMT.format(week.end)}
                </span>
                <span className={`pub-week-count${count ? "" : " is-empty"}`}>
                  {postsLabel(count)}
                </span>
              </div>
              <div className="pub-week-posts">
                {week.items.map((entry) => (
                  <WeekCard key={entry.targetId} entry={entry} />
                ))}
                {count === 0 && !week.isPast ? (
                  <div className="pub-week-slot">
                    <p>Brak posta w tym tygodniu</p>
                    <Link
                      href="/publikacje?nowy=1"
                      className="ui-btn ui-btn-outline ui-btn-sm"
                    >
                      <Plus aria-hidden />
                      Zaplanuj post
                    </Link>
                    <TopicsButton
                      className="ui-btn ui-btn-ghost ui-btn-sm pub-week-slot-ai"
                      pickLabel="Wybierz temat"
                    />
                  </div>
                ) : null}
                {count === 0 && week.isPast ? (
                  <p className="pub-week-none">Nic nie opublikowano</p>
                ) : null}
                {count > 0 && !week.isPast ? (
                  <Link
                    href="/publikacje?nowy=1"
                    className="pub-week-add"
                    aria-label="Dodaj post"
                  >
                    <Plus aria-hidden />
                  </Link>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
