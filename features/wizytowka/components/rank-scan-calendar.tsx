"use client";

import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { RANK_TIMEZONE } from "@/lib/config/rank-limits";

const WEEKDAYS = ["Pn", "Wt", "Śr", "Cz", "Pt", "Sb", "Nd"] as const;

function warsawTodayKey(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: RANK_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function monthLabel(year: number, month: number): string {
  const d = new Date(Date.UTC(year, month, 1));
  return d.toLocaleDateString("pl-PL", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

/** Monday=0 … Sunday=6 for the 1st of month */
function mondayOffset(year: number, month: number): number {
  const dow = new Date(Date.UTC(year, month, 1)).getUTCDay();
  return dow === 0 ? 6 : dow - 1;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

type CalCell = {
  day: number;
  key: string;
  outside: boolean;
};

export function RankScanCalendar({
  scanDays,
  selectedDay,
  onSelectDay,
  children,
}: {
  scanDays: string[];
  selectedDay: string | null;
  onSelectDay: (dayKey: string) => void;
  children?: ReactNode;
}) {
  const today = warsawTodayKey();
  const initial = selectedDay ?? today;
  const [y, m] = initial.split("-").map(Number);
  const [cursor, setCursor] = useState({ year: y, month: m - 1 });

  const scanSet = useMemo(() => new Set(scanDays), [scanDays]);

  const cells = useMemo(() => {
    const total = daysInMonth(cursor.year, cursor.month);
    const offset = mondayOffset(cursor.year, cursor.month);
    const list: CalCell[] = [];

    const prevMonth = cursor.month === 0 ? 11 : cursor.month - 1;
    const prevYear = cursor.month === 0 ? cursor.year - 1 : cursor.year;
    const prevTotal = daysInMonth(prevYear, prevMonth);
    for (let i = offset - 1; i >= 0; i--) {
      const day = prevTotal - i;
      list.push({
        day,
        key: `${prevYear}-${pad2(prevMonth + 1)}-${pad2(day)}`,
        outside: true,
      });
    }

    for (let d = 1; d <= total; d++) {
      list.push({
        day: d,
        key: `${cursor.year}-${pad2(cursor.month + 1)}-${pad2(d)}`,
        outside: false,
      });
    }

    const nextMonth = cursor.month === 11 ? 0 : cursor.month + 1;
    const nextYear = cursor.month === 11 ? cursor.year + 1 : cursor.year;
    let nextDay = 1;
    while (list.length < 42) {
      list.push({
        day: nextDay,
        key: `${nextYear}-${pad2(nextMonth + 1)}-${pad2(nextDay)}`,
        outside: true,
      });
      nextDay += 1;
    }
    return list;
  }, [cursor]);

  function shiftMonth(delta: number) {
    setCursor((prev) => {
      const date = new Date(Date.UTC(prev.year, prev.month + delta, 1));
      return { year: date.getUTCFullYear(), month: date.getUTCMonth() };
    });
  }

  return (
    <aside className="rank-calendar">
      <div className="rank-calendar-nav">
        <button
          type="button"
          className="rank-calendar-nav-btn"
          aria-label="Poprzedni miesiąc"
          onClick={() => shiftMonth(-1)}
        >
          <ChevronLeft aria-hidden />
        </button>
        <span className="rank-calendar-month">
          {monthLabel(cursor.year, cursor.month)}
        </span>
        <button
          type="button"
          className="rank-calendar-nav-btn"
          aria-label="Następny miesiąc"
          onClick={() => shiftMonth(1)}
        >
          <ChevronRight aria-hidden />
        </button>
      </div>

      <div className="rank-calendar-grid" role="grid">
        {WEEKDAYS.map((wd) => (
          <div key={wd} className="rank-calendar-wd">
            {wd}
          </div>
        ))}
        {cells.map((cell) => {
          const hasScan = !cell.outside && scanSet.has(cell.key);
          const isSelected = selectedDay === cell.key;
          const isToday = cell.key === today;
          const clickable = hasScan;
          return (
            <button
              key={cell.key}
              type="button"
              className={[
                "rank-calendar-cell",
                cell.outside ? "is-outside" : "is-current",
                isSelected ? "is-selected" : "",
                isToday && !cell.outside ? "is-today" : "",
                hasScan ? "has-scan" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => {
                if (clickable) onSelectDay(cell.key);
              }}
              disabled={!clickable}
            >
              <span>{cell.day}</span>
              {hasScan ? (
                <span className="rank-calendar-dot" aria-hidden />
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="rank-calendar-legend" aria-hidden>
        <span className="rank-calendar-legend-item">
          <span className="rank-calendar-legend-dot" />
          Dzień ze skanem
        </span>
        <span className="rank-calendar-legend-item">
          <span className="rank-calendar-legend-picked" />
          Wybrany
        </span>
      </div>

      {children}

      {scanDays.length === 0 ? (
        <p className="rank-calendar-empty">Brak historii skanów</p>
      ) : null}
    </aside>
  );
}
