"use client";

import { useState, useTransition, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CalendarX2,
  Check,
  ImageIcon,
  Loader2,
  TriangleAlert,
  X,
} from "lucide-react";
import { toast } from "@/lib/toast";
import { DateField } from "@/components/ui/date-field";
import { TimeField } from "@/components/ui/time-field";
import { useAnchoredPopover } from "@/components/ui/use-anchored-popover";
import {
  cancelScheduledContent,
  rescheduleContent,
} from "@/features/publikacje/actions";

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** Local (browser) day and time of a date - the fields work in local time. */
function localParts(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

function todayValue(): string {
  return localParts(new Date().toISOString()).date;
}

/** `yyyy-mm-dd` (local) + days. */
function addDays(value: string, days: number): string {
  const [y, m, d] = value.split("-").map(Number);
  return localParts(new Date(y, m - 1, d + days).toISOString()).date;
}

function nextMonday(value: string): string {
  const [y, m, d] = value.split("-").map(Number);
  const day = new Date(y, m - 1, d).getDay();
  return addDays(value, (8 - day) % 7 || 7);
}

const SHORT_DAY = new Intl.DateTimeFormat("pl-PL", {
  weekday: "short",
  day: "numeric",
  month: "short",
});
const WHEN_FMT = new Intl.DateTimeFormat("pl-PL", {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});
const WEEKDAY = new Intl.DateTimeFormat("pl-PL", { weekday: "long" });

/** "czw., 15 paź" -> "czw 15 paź" */
function short(fmt: Intl.DateTimeFormat, date: Date): string {
  return fmt.format(date).replace(/\.,? /, " ");
}

function toDate(date: string, time = "00:00"): Date {
  return new Date(`${date}T${time}:00`);
}

function daysWord(n: number): string {
  if (n === 0) return "dziś";
  if (n === 1) return "jutro";
  return `za ${n} dni`;
}

/**
 * A scheduled post's menu: change the date or cancel the publication (the
 * post goes back to "Do akceptacji"). The trigger is whatever the caller
 * shows for the post - a button on the list, the entry in the calendar.
 */
export function ScheduledPostMenu({
  itemId,
  title,
  scheduledAt,
  triggerClassName,
  triggerLabel,
  imageUrl = null,
  channelLabel = null,
  children,
}: {
  itemId: string;
  title: string;
  scheduledAt: string;
  imageUrl?: string | null;
  /** Where it goes out, e.g. "Google" */
  channelLabel?: string | null;
  triggerClassName: string;
  /** aria-label of the trigger (its content may be only an icon or a card). */
  triggerLabel: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const { open, setOpen, close, style, triggerRef, panelRef, panelProps } =
    useAnchoredPopover();
  const [pending, startTransition] = useTransition();
  const initial = localParts(scheduledAt);
  const [date, setDate] = useState(initial.date);
  const [time, setTime] = useState(initial.time);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const changed = date !== initial.date || time !== initial.time;
  const today = todayValue();
  const daysLeft = Math.max(
    0,
    Math.round((toDate(date).getTime() - toDate(today).getTime()) / 86_400_000),
  );
  const quick = [
    { label: "Jutro", date: addDays(today, 1) },
    {
      label: short(SHORT_DAY, toDate(nextMonday(today))),
      date: nextMonday(today),
    },
    { label: "+1 tydzień", date: addDays(initial.date, 7) },
  ];

  function toggle() {
    if (!open) {
      setDate(initial.date);
      setTime(initial.time);
      setConfirmCancel(false);
    }
    setOpen(!open);
  }

  function save() {
    const when = new Date(`${date}T${time}:00`);
    if (!date || Number.isNaN(when.getTime()) || when.getTime() < Date.now()) {
      toast.error({ title: "Nowy termin musi być w przyszłości" });
      return;
    }
    startTransition(async () => {
      const result = await rescheduleContent({
        itemId,
        scheduledAt: when.toISOString(),
      });
      if (!result.ok) {
        toast.error({
          title: "Nie zmieniono terminu",
          description: result.error,
        });
        return;
      }
      toast.success({ title: "Zmieniono termin publikacji" });
      setOpen(false);
      router.refresh();
    });
  }

  function cancelPublication() {
    startTransition(async () => {
      const result = await cancelScheduledContent({ itemId });
      if (!result.ok) {
        toast.error({ title: "Nie anulowano", description: result.error });
        return;
      }
      toast.success({
        title: "Anulowano publikację",
        description: "Post wrócił do „Do akceptacji”.",
      });
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={triggerClassName}
        aria-label={triggerLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={toggle}
      >
        {children}
      </button>

      {open
        ? createPortal(
            <div
              ref={panelRef}
              {...panelProps}
              className="ui-reject-pop pub-sched-pop"
              role="dialog"
              aria-label="Zaplanowany post"
              style={style}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  close();
                }
              }}
            >
              <div className="pub-sched-head">
                <span className="pub-sched-thumb" aria-hidden>
                  {imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- public R2 URL, domain set per environment
                    <img src={imageUrl} alt="" />
                  ) : (
                    <ImageIcon />
                  )}
                </span>
                <div className="pub-sched-head-text">
                  <span className="pub-sched-status">
                    <span className="pub-sched-dot" aria-hidden />
                    Zaplanowany{channelLabel ? ` · ${channelLabel}` : ""}
                  </span>
                  <p className="pub-sched-title">{title}</p>
                </div>
                <button
                  type="button"
                  className="pub-sched-close"
                  aria-label="Zamknij"
                  onClick={close}
                >
                  <X aria-hidden />
                </button>
              </div>

              {confirmCancel ? (
                <div className="pub-sched-confirm" role="alert">
                  <TriangleAlert aria-hidden />
                  <div>
                    <p className="pub-sched-confirm-title">
                      Anulować publikację?
                    </p>
                    <p className="pub-sched-confirm-text">
                      Post nie wyjdzie {short(SHORT_DAY, toDate(initial.date))}.
                      Wróci do „Do akceptacji” - możesz go poprawić i zaplanować
                      ponownie.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="pub-sched-body">
                  <span className="pub-sched-label">Termin publikacji</span>
                  <div className="pub-card-schedule pub-sched-fields">
                    <DateField
                      className={`pub-card-date-field${date !== initial.date ? " is-changed" : ""}`}
                      ariaLabel="Dzień publikacji"
                      value={date}
                      min={todayValue()}
                      disabled={pending}
                      onChange={setDate}
                    />
                    <TimeField
                      className={`pub-card-time${time !== initial.time ? " is-changed" : ""}`}
                      ariaLabel="Godzina publikacji"
                      value={time}
                      onChange={setTime}
                    />
                  </div>
                  <div className="pub-sched-quick">
                    {quick.map((option) => (
                      <button
                        key={option.label}
                        type="button"
                        className={`ui-reject-pop-chip${date === option.date ? " is-active" : ""}`}
                        disabled={pending}
                        onClick={() => setDate(option.date)}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                  {changed ? (
                    <p className="pub-sched-hint is-diff">
                      <s>
                        {short(WHEN_FMT, toDate(initial.date, initial.time))}
                      </s>
                      <ArrowRight aria-hidden />
                      <strong>{short(WHEN_FMT, toDate(date, time))}</strong>
                    </p>
                  ) : (
                    <p className="pub-sched-hint">
                      Wyjdzie <span className="mono">{daysWord(daysLeft)}</span>{" "}
                      · {WEEKDAY.format(toDate(date))}
                    </p>
                  )}
                </div>
              )}

              <div className="pub-sched-foot">
                {confirmCancel ? (
                  <>
                    <button
                      type="button"
                      className="ui-btn ui-btn-ghost ui-btn-sm"
                      disabled={pending}
                      onClick={() => setConfirmCancel(false)}
                    >
                      Wróć
                    </button>
                    <button
                      type="button"
                      className="ui-btn ui-btn-danger ui-btn-sm"
                      disabled={pending}
                      onClick={cancelPublication}
                    >
                      {pending ? (
                        <Loader2 aria-hidden className="ui-btn-spinner" />
                      ) : (
                        <CalendarX2 aria-hidden />
                      )}
                      Tak, anuluj
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      className="pub-sched-cancel"
                      disabled={pending}
                      onClick={() => setConfirmCancel(true)}
                    >
                      <CalendarX2 aria-hidden />
                      Anuluj publikację
                    </button>
                    <button
                      type="button"
                      className="ui-btn ui-btn-primary ui-btn-sm"
                      disabled={pending || !changed}
                      onClick={save}
                    >
                      {pending ? (
                        <Loader2 aria-hidden className="ui-btn-spinner" />
                      ) : (
                        <Check aria-hidden />
                      )}
                      Zapisz termin
                    </button>
                  </>
                )}
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
