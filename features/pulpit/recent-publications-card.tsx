import Link from "next/link";
import {
  ArrowUpRight,
  CalendarPlus,
  ChevronRight,
  Clock,
  FileText,
  Sparkles,
} from "lucide-react";
import { CHANNEL_LABELS } from "@/features/publikacje/content-status";
import type { PublishingRhythm } from "@/features/publikacje/load-published";
import type { PulpitPublication } from "@/features/pulpit/load-pulpit";

const DATE_FMT = new Intl.DateTimeFormat("pl-PL", {
  day: "numeric",
  month: "short",
  timeZone: "Europe/Warsaw",
});

const NEXT_FMT = new Intl.DateTimeFormat("pl-PL", {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Warsaw",
});

const WEEK_FMT = new Intl.DateTimeFormat("pl-PL", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

function weeksWord(count: number): string {
  if (count === 1) return "tydzień";
  const last = count % 10;
  const lastTwo = count % 100;
  return last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)
    ? "tygodnie"
    : "tygodni";
}

/** Last weeks as bars: filled = a post went out that week (Google rewards regular posts). */
function Rhythm({ rhythm }: { rhythm: PublishingRhythm }) {
  const done = rhythm.weeks.filter((week) => week.published).length;
  const first = rhythm.weeks[0];
  return (
    <div className="pulpit-rhythm">
      <div className="pulpit-rhythm-head">
        <span>
          Regularność{" "}
          <strong className="mono">
            {done}/{rhythm.weeks.length}
          </strong>{" "}
          {weeksWord(rhythm.weeks.length)} z postem
        </span>
        <span>cel: 1 post tygodniowo</span>
      </div>
      <ol
        className="pulpit-rhythm-bars"
        aria-label={`Posty w ostatnich ${rhythm.weeks.length} tygodniach`}
      >
        {rhythm.weeks.map((week, index) => {
          const current = index === rhythm.weeks.length - 1;
          const label = `${current ? "Ten tydzień" : `Tydzień od ${WEEK_FMT.format(new Date(`${week.start}T00:00:00Z`))}`}: ${week.published ? "opublikowano" : "brak posta"}`;
          return (
            <li
              key={week.start}
              className={`${week.published ? "is-on" : ""}${current ? " is-current" : ""}`}
              title={label}
              aria-label={label}
            />
          );
        })}
      </ol>
      <div className="pulpit-rhythm-scale mono" aria-hidden>
        <span>
          {first ? WEEK_FMT.format(new Date(`${first.start}T00:00:00Z`)) : ""}
        </span>
        <span>ten tydzień</span>
      </div>
    </div>
  );
}

function NextPost({ next }: { next: PublishingRhythm["next"] }) {
  if (!next) {
    return (
      <div className="pulpit-next is-empty">
        <span className="pulpit-next-icon" aria-hidden>
          <CalendarPlus />
        </span>
        <span className="pulpit-next-copy">
          <span className="pulpit-next-title">Nic nie jest zaplanowane</span>
          <span className="pulpit-next-meta">
            Google premiuje regularne posty - dodaj coś na ten tydzień.
          </span>
        </span>
        <Link
          href="/publikacje?tematy=1"
          className="ui-btn ui-btn-primary ui-btn-sm"
        >
          <Sparkles aria-hidden />
          Wybierz temat
        </Link>
      </div>
    );
  }
  return (
    <Link href="/publikacje/kalendarz" className="pulpit-next">
      <span className="pulpit-next-icon" aria-hidden>
        <Clock />
      </span>
      <span className="pulpit-next-copy">
        <span className="pulpit-next-label">
          Następny
          {next.date ? (
            <>
              {" "}
              · <span className="mono">{NEXT_FMT.format(next.date)}</span>
            </>
          ) : null}
        </span>
        <span className="pulpit-next-title">{next.title}</span>
      </span>
      <ChevronRight aria-hidden className="pulpit-action-go" />
    </Link>
  );
}

/**
 * Pulpit tile: how regularly posts go out, what goes out next, and the latest
 * posts actually published (content_targets = published).
 */
export function RecentPublicationsCard({
  publications,
  rhythm,
}: {
  publications: PulpitPublication[];
  rhythm: PublishingRhythm | null;
}) {
  return (
    <section className="pulpit-card">
      <header className="pulpit-card-head">
        <div className="pulpit-title-row">
          <span className="pulpit-icon-circle is-dark" aria-hidden>
            <FileText />
          </span>
          <div>
            <h2 className="pulpit-card-title">Ostatnie publikacje</h2>
            <p className="pulpit-card-lead">Posty opublikowane w Google.</p>
          </div>
        </div>
      </header>

      <div className="pulpit-pub-body">
        {rhythm ? <Rhythm rhythm={rhythm} /> : null}
        {rhythm ? <NextPost next={rhythm.next} /> : null}

        {publications.length === 0 ? (
          <p className="pulpit-empty">
            Jeszcze nic nie zostało opublikowane.{" "}
            <Link href="/publikacje?status=pending" className="wiz-inline-link">
              Zobacz propozycje AI
            </Link>
            .
          </p>
        ) : (
          <div>
            <h3 className="pulpit-action-group-title">Ostatnie</h3>
            <ul className="pulpit-action-list">
              {publications.map((item) => (
                <li key={item.targetId}>
                  <Link
                    href="/publikacje?status=published"
                    className="pulpit-action-row pulpit-post-row"
                  >
                    <span className="pulpit-post-thumb" aria-hidden>
                      {item.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element -- public R2 URL, domain set per environment
                        <img src={item.imageUrl} alt="" />
                      ) : (
                        <FileText />
                      )}
                    </span>
                    <span className="pulpit-action-copy">
                      <span className="pulpit-action-title pulpit-post-title">
                        {item.title}
                      </span>
                      <span className="pulpit-action-meta pulpit-post-meta">
                        <span className="pulpit-post-dot" aria-hidden />
                        Opublikowano · {CHANNEL_LABELS[item.channel]} ·{" "}
                        <span className="mono">
                          {item.date ? DATE_FMT.format(item.date) : "-"}
                        </span>
                      </span>
                    </span>
                    <ChevronRight aria-hidden className="pulpit-action-go" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <Link href="/publikacje?status=all" className="pulpit-card-foot">
        Zobacz wszystkie
        <ArrowUpRight aria-hidden />
      </Link>
    </section>
  );
}
