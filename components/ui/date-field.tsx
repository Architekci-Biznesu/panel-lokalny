"use client";

import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";

const GAP = 6;
const WEEKDAYS = ["pn", "wt", "śr", "cz", "pt", "sb", "nd"];

const MONTH_FMT = new Intl.DateTimeFormat("pl-PL", {
  month: "long",
  year: "numeric",
});
const VALUE_FMT = new Intl.DateTimeFormat("pl-PL", {
  day: "numeric",
  month: "short",
  year: "numeric",
});
const DAY_LABEL_FMT = new Intl.DateTimeFormat("pl-PL", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Local date -> "YYYY-MM-DD" (the input[type=date] format). */
function toValue(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function parseValue(value: string | undefined): Date | null {
  const match = value ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(value) : null;
  if (!match) return null;
  const date = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
  );
  return Number.isNaN(date.getTime()) ? null : date;
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

/** 6 weeks (Monday first) covering the month, so the panel height is stable. */
function monthDays(month: Date): Date[] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const start = addDays(first, -((first.getDay() + 6) % 7));
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

/**
 * Pole daty (YYYY-MM-DD) w stylu panelu zamiast natywnego input[type=date].
 * Kalendarz miesiąca w portalu z pozycją fixed (jak TimeField), otwiera się w
 * górę, gdy pod polem brakuje miejsca. Strzałki przesuwają dzień, Enter
 * wybiera, Esc zamyka. `min` blokuje wcześniejsze dni.
 */
export function DateField({
  value,
  onChange,
  ariaLabel,
  className,
  min,
  placeholder = "Wybierz dzień",
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  className?: string;
  /** Earliest day to pick, "YYYY-MM-DD" */
  min?: string;
  placeholder?: string;
  disabled?: boolean;
}) {
  const selected = parseValue(value);
  const minDate = parseValue(min);
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => selected ?? new Date());
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const [style, setStyle] = useState<CSSProperties>({ visibility: "hidden" });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const todayKey = toValue(new Date());
  const minKey = minDate ? toValue(minDate) : null;
  const isBlocked = (key: string) => (minKey ? key < minKey : false);

  const place = useCallback(() => {
    const trigger = triggerRef.current;
    const panel = panelRef.current;
    if (!trigger || !panel) return;
    const rect = trigger.getBoundingClientRect();
    const height = panel.offsetHeight;
    const below = window.innerHeight - rect.bottom;
    const openUp = below < height + GAP * 2 && rect.top > below;
    setStyle({
      left: Math.min(
        Math.max(GAP * 2, rect.left),
        window.innerWidth - panel.offsetWidth - GAP * 2,
      ),
      top: openUp ? rect.top - height - GAP : rect.bottom + GAP,
      transformOrigin: openUp ? "bottom left" : "top left",
    });
  }, []);

  useLayoutEffect(() => {
    if (open) place();
  }, [open, place]);

  // Keyboard focus follows the highlighted day (also after month changes).
  useEffect(() => {
    if (!open || !focusKey) return;
    panelRef.current
      ?.querySelector<HTMLElement>(`[data-day="${focusKey}"]`)
      ?.focus({ preventScroll: true });
  }, [open, focusKey, month]);

  useEffect(() => {
    if (!open) return;
    function onDown(event: MouseEvent) {
      const target = event.target as Node;
      if (
        panelRef.current?.contains(target) ||
        triggerRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    }
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    document.addEventListener("mousedown", onDown);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open, place]);

  function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    const start = selected ?? minDate ?? new Date();
    setMonth(start);
    setFocusKey(toValue(start));
    setOpen(true);
  }

  function close() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  function pick(date: Date) {
    const key = toValue(date);
    if (isBlocked(key)) return;
    onChange(key);
    close();
  }

  function shiftMonth(delta: number) {
    setMonth((m) => new Date(m.getFullYear(), m.getMonth() + delta, 1));
    setFocusKey(null);
  }

  function moveFocus(from: Date, days: number) {
    const next = addDays(from, days);
    if (
      next.getMonth() !== month.getMonth() ||
      next.getFullYear() !== month.getFullYear()
    ) {
      setMonth(new Date(next.getFullYear(), next.getMonth(), 1));
    }
    setFocusKey(toValue(next));
  }

  const prevDisabled =
    minDate !== null &&
    new Date(month.getFullYear(), month.getMonth(), 1) <=
      new Date(minDate.getFullYear(), minDate.getMonth(), 1);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`ui-field ui-date-field${open ? " is-open" : ""}${selected ? "" : " is-empty"}${className ? ` ${className}` : ""}`}
        aria-label={`${ariaLabel}: ${selected ? DAY_LABEL_FMT.format(selected) : "nie wybrano"}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        disabled={disabled}
        onClick={toggle}
      >
        <span>{selected ? VALUE_FMT.format(selected) : placeholder}</span>
        <CalendarDays aria-hidden />
      </button>

      {open
        ? createPortal(
            <div
              ref={panelRef}
              className="ui-date-pop"
              role="dialog"
              aria-label={ariaLabel}
              style={style}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  close();
                }
              }}
            >
              <div className="ui-date-head">
                <button
                  type="button"
                  className="ui-date-nav"
                  aria-label="Poprzedni miesiąc"
                  disabled={prevDisabled}
                  onClick={() => shiftMonth(-1)}
                >
                  <ChevronLeft aria-hidden />
                </button>
                <p className="ui-date-month" aria-live="polite">
                  {MONTH_FMT.format(month)}
                </p>
                <button
                  type="button"
                  className="ui-date-nav"
                  aria-label="Następny miesiąc"
                  onClick={() => shiftMonth(1)}
                >
                  <ChevronRight aria-hidden />
                </button>
              </div>

              <div className="ui-date-grid" role="grid">
                {WEEKDAYS.map((day) => (
                  <span
                    key={day}
                    className="ui-date-weekday"
                    role="columnheader"
                  >
                    {day}
                  </span>
                ))}
                {monthDays(month).map((date) => {
                  const key = toValue(date);
                  const outside = date.getMonth() !== month.getMonth();
                  const blocked = isBlocked(key);
                  const active = value === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      data-day={key}
                      role="gridcell"
                      aria-selected={active}
                      aria-label={DAY_LABEL_FMT.format(date)}
                      tabIndex={key === focusKey ? 0 : -1}
                      disabled={blocked}
                      className={`ui-date-day mono${outside ? " is-out" : ""}${key === todayKey ? " is-today" : ""}${active ? " is-active" : ""}`}
                      onClick={() => pick(date)}
                      onKeyDown={(event) => {
                        const moves: Record<string, number> = {
                          ArrowLeft: -1,
                          ArrowRight: 1,
                          ArrowUp: -7,
                          ArrowDown: 7,
                        };
                        const days = moves[event.key];
                        if (days) {
                          event.preventDefault();
                          moveFocus(date, days);
                        }
                      }}
                    >
                      {date.getDate()}
                    </button>
                  );
                })}
              </div>

              <div className="ui-date-foot">
                <button
                  type="button"
                  className="ui-date-link"
                  disabled={isBlocked(todayKey)}
                  onClick={() => pick(new Date())}
                >
                  Dziś
                </button>
                <button
                  type="button"
                  className="ui-date-link"
                  disabled={isBlocked(toValue(addDays(new Date(), 1)))}
                  onClick={() => pick(addDays(new Date(), 1))}
                >
                  Jutro
                </button>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
