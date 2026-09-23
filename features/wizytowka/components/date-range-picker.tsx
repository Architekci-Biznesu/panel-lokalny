"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { CalendarRange, ChevronLeft, ChevronRight } from "lucide-react";
import {
  addDays,
  addMonths,
  clampRange,
  formatDateIso,
  formatDatePl,
  fromDateParts,
  MAX_RANGE_MONTHS,
  toDateParts,
  yesterdayParts,
  type DateParts,
} from "@/features/wizytowka/performance";

const WEEKDAYS_PL = ["Pn", "Wt", "Śr", "Cz", "Pt", "So", "Nd"];
const MONTHS_PL = [
  "Styczeń",
  "Luty",
  "Marzec",
  "Kwiecień",
  "Maj",
  "Czerwiec",
  "Lipiec",
  "Sierpień",
  "Wrzesień",
  "Październik",
  "Listopad",
  "Grudzień",
];

type Props = {
  start: DateParts;
  end: DateParts;
};

type Draft = { start: DateParts | null; end: DateParts | null };

function startOfMonth(parts: DateParts): Date {
  return new Date(parts.year, parts.month - 1, 1);
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function sameDay(a: DateParts, b: DateParts) {
  return a.year === b.year && a.month === b.month && a.day === b.day;
}

function isBefore(a: DateParts, b: DateParts) {
  return fromDateParts(a) < fromDateParts(b);
}

function isAfter(a: DateParts, b: DateParts) {
  return fromDateParts(a) > fromDateParts(b);
}

function inRange(day: DateParts, start: DateParts | null, end: DateParts | null) {
  if (!start || !end) return false;
  const t = fromDateParts(day).getTime();
  return t >= fromDateParts(start).getTime() && t <= fromDateParts(end).getTime();
}

export function DateRangePicker({ start, end }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>({ start, end });
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(end));
  const maxEnd = yesterdayParts();

  useEffect(() => {
    if (!open) return;
    setDraft({ start, end });
    setViewMonth(startOfMonth(end));
  }, [open, start, end]);

  useEffect(() => {
    if (!open) return;
    function onDoc(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const label = `${formatDatePl(start)} - ${formatDatePl(end)}`;

  const months = useMemo(() => {
    const current = toDateParts(viewMonth);
    const prevDate = new Date(viewMonth);
    prevDate.setMonth(prevDate.getMonth() - 1);
    return [toDateParts(prevDate), current];
  }, [viewMonth]);

  function applyPreset(kind: "7d" | "30d" | "3m" | "6m" | "12m" | "18m") {
    const endParts = maxEnd;
    let startParts: DateParts;
    if (kind === "7d") startParts = addDays(endParts, -6);
    else if (kind === "30d") startParts = addDays(endParts, -29);
    else if (kind === "3m") startParts = addMonths(endParts, -3);
    else if (kind === "6m") startParts = addMonths(endParts, -6);
    else if (kind === "12m") startParts = addMonths(endParts, -12);
    else startParts = addMonths(endParts, -MAX_RANGE_MONTHS);
    const clamped = clampRange(startParts, endParts);
    setDraft({ start: clamped.start, end: clamped.end });
    setViewMonth(startOfMonth(clamped.end));
  }

  function pickDay(day: DateParts) {
    if (isAfter(day, maxEnd)) return;
    setDraft((prev) => {
      if (!prev.start || (prev.start && prev.end)) {
        return { start: day, end: null };
      }
      if (isBefore(day, prev.start)) {
        return { start: day, end: prev.start };
      }
      const clamped = clampRange(prev.start, day);
      return { start: clamped.start, end: clamped.end };
    });
  }

  function apply() {
    if (!draft.start || !draft.end) return;
    const clamped = clampRange(draft.start, draft.end);
    const params = new URLSearchParams();
    params.set("start", formatDateIso(clamped.start));
    params.set("end", formatDateIso(clamped.end));
    router.push(`${pathname}?${params.toString()}`);
    setOpen(false);
  }

  return (
    <div className="wiz-range-picker" ref={rootRef}>
      <button
        type="button"
        className="ui-btn ui-btn-outline ui-btn-sm"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((v) => !v)}
      >
        <CalendarRange aria-hidden />
        <span className="mono">{label}</span>
      </button>

      {open ? (
        <div className="wiz-range-popover" role="dialog" aria-label="Zakres dat">
          <div className="wiz-range-presets">
            {(
              [
                ["7d", "7 dni"],
                ["30d", "30 dni"],
                ["3m", "3 mies."],
                ["6m", "6 mies."],
                ["12m", "12 mies."],
                ["18m", "18 mies."],
              ] as const
            ).map(([key, text]) => (
              <button
                key={key}
                type="button"
                className="ui-btn ui-btn-ghost ui-btn-sm"
                onClick={() => applyPreset(key)}
              >
                {text}
              </button>
            ))}
          </div>

          <div className="wiz-range-nav">
            <button
              type="button"
              className="ui-btn ui-btn-ghost ui-btn-sm"
              aria-label="Poprzedni miesiąc"
              onClick={() =>
                setViewMonth(
                  new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1),
                )
              }
            >
              <ChevronLeft aria-hidden />
            </button>
            <button
              type="button"
              className="ui-btn ui-btn-ghost ui-btn-sm"
              aria-label="Następny miesiąc"
              disabled={
                viewMonth.getFullYear() > maxEnd.year ||
                (viewMonth.getFullYear() === maxEnd.year &&
                  viewMonth.getMonth() + 1 >= maxEnd.month)
              }
              onClick={() =>
                setViewMonth(
                  new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1),
                )
              }
            >
              <ChevronRight aria-hidden />
            </button>
          </div>

          <div className="wiz-range-months">
            {months.map((month) => (
              <MonthGrid
                key={`${month.year}-${month.month}`}
                month={month}
                draft={draft}
                maxEnd={maxEnd}
                onPick={pickDay}
              />
            ))}
          </div>

          <div className="wiz-range-footer">
            <p className="wiz-range-hint">
              Max {MAX_RANGE_MONTHS} mies. · do {formatDatePl(maxEnd)}
            </p>
            <div className="wiz-services-sticky-actions">
              <button
                type="button"
                className="ui-btn ui-btn-outline ui-btn-sm"
                onClick={() => setOpen(false)}
              >
                Anuluj
              </button>
              <button
                type="button"
                className="ui-btn ui-btn-primary ui-btn-sm"
                disabled={!draft.start || !draft.end}
                onClick={apply}
              >
                Zastosuj
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MonthGrid({
  month,
  draft,
  maxEnd,
  onPick,
}: {
  month: DateParts;
  draft: Draft;
  maxEnd: DateParts;
  onPick: (day: DateParts) => void;
}) {
  const first = startOfMonth(month);
  // Monday-first: JS getDay() Sun=0
  const offset = (first.getDay() + 6) % 7;
  const count = daysInMonth(month.year, month.month);
  const cells: Array<DateParts | null> = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let day = 1; day <= count; day++) {
    cells.push({ year: month.year, month: month.month, day });
  }

  return (
    <div className="wiz-range-month">
      <p className="wiz-range-month-title">
        {MONTHS_PL[month.month - 1]} {month.year}
      </p>
      <div className="wiz-range-weekdays">
        {WEEKDAYS_PL.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="wiz-range-days">
        {cells.map((day, index) => {
          if (!day) return <span key={`e-${index}`} className="wiz-range-day is-empty" />;
          const disabled = isAfter(day, maxEnd);
          const isStart = draft.start ? sameDay(day, draft.start) : false;
          const isEnd = draft.end ? sameDay(day, draft.end) : false;
          const selected = isStart || isEnd;
          const between = inRange(day, draft.start, draft.end) && !selected;
          return (
            <button
              key={formatDateIso(day)}
              type="button"
              className={[
                "wiz-range-day",
                selected ? "is-selected" : "",
                between ? "is-in-range" : "",
                disabled ? "is-disabled" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              disabled={disabled}
              onClick={() => onPick(day)}
            >
              {day.day}
            </button>
          );
        })}
      </div>
    </div>
  );
}
