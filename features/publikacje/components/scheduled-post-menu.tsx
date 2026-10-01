"use client";

import { useState, useTransition, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { CalendarX2, Check, Loader2 } from "lucide-react";
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
  children,
}: {
  itemId: string;
  title: string;
  scheduledAt: string;
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
              className="ui-reject-pop"
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
              <div className="ui-reject-pop-head">
                <p className="ui-reject-pop-title">
                  {confirmCancel ? "Anulować publikację?" : "Zaplanowany post"}
                </p>
                <p className="ui-reject-pop-desc">
                  {confirmCancel
                    ? "Post nie zostanie opublikowany i wróci do „Do akceptacji” - możesz go poprawić i zaplanować ponownie."
                    : title}
                </p>
              </div>

              {confirmCancel ? null : (
                <div className="pub-card-schedule">
                  <DateField
                    className="pub-card-date-field"
                    ariaLabel="Dzień publikacji"
                    value={date}
                    min={todayValue()}
                    disabled={pending}
                    onChange={setDate}
                  />
                  <TimeField
                    className="pub-card-time"
                    ariaLabel="Godzina publikacji"
                    value={time}
                    onChange={setTime}
                  />
                </div>
              )}

              <div className="ui-reject-pop-foot">
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
                      Anuluj publikację
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      className="ui-btn ui-btn-soft-danger ui-btn-sm"
                      disabled={pending}
                      onClick={() => setConfirmCancel(true)}
                    >
                      <CalendarX2 aria-hidden />
                      Anuluj publikację
                    </button>
                    <button
                      type="button"
                      className="ui-btn ui-btn-primary ui-btn-sm"
                      disabled={pending}
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
