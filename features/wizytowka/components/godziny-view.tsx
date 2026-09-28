"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { CircleAlert, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "gooey-toast";
import {
  updateGbpRegularHours,
  updateGbpSpecialHours,
} from "@/features/wizytowka/actions";
import { TimeField } from "@/components/ui/time-field";
import {
  getUpcomingHolidayHint,
  holidayNameFor,
  upcomingHolidays,
  type Holiday,
} from "@/features/wizytowka/polish-holidays";
import {
  WEEKDAYS,
  formatTime,
  type GbpLocation,
  type GbpPeriod,
  type GbpSpecialHourPeriod,
} from "@/features/wizytowka/types";

const MONTH_SHORT = [
  "STY",
  "LUT",
  "MAR",
  "KWI",
  "MAJ",
  "CZE",
  "LIP",
  "SIE",
  "WRZ",
  "PAŹ",
  "LIS",
  "GRU",
];

/** Ile najbliższych świąt proponować jako dni zamknięte. */
const HOLIDAY_SUGGESTIONS = 6;

export function GodzinyView({ location }: { location: GbpLocation }) {
  // Edytowany jest tylko otwarty kafel; drugi zostaje w podglądzie.
  const [editing, setEditing] = useState<"hours" | "special" | null>(null);
  const [seedEmptySpecial, setSeedEmptySpecial] = useState(false);
  const periods = location.regularHours?.periods ?? [];
  const special = useMemo(
    () => location.specialHours?.specialHourPeriods ?? [],
    [location.specialHours?.specialHourPeriods],
  );
  const upcomingHint = useMemo(
    () => getUpcomingHolidayHint(special),
    [special],
  );

  function enterEdit(
    tile: "hours" | "special",
    opts?: { seedSpecial?: boolean },
  ) {
    setSeedEmptySpecial(Boolean(opts?.seedSpecial));
    setEditing(tile);
  }

  function exitEdit() {
    setEditing(null);
    setSeedEmptySpecial(false);
  }

  const editingHours = editing === "hours";
  const editingSpecial = editing === "special";

  return (
    <div className="wiz-hours-row" id="wiz-field-hours">
      <article className={`wiz-hours-tile${editingHours ? " is-editing" : ""}`}>
        {editingHours ? (
          <HoursEditor
            initial={periods}
            onDone={exitEdit}
            onCancel={exitEdit}
          />
        ) : (
          <>
            <header className="wiz-hours-col-head">
              <h3 className="wiz-hours-tile-title">Godziny otwarcia</h3>
              <button
                type="button"
                className="wiz-field-edit"
                aria-label="Edytuj godziny"
                onClick={() => enterEdit("hours")}
              >
                <Pencil aria-hidden />
              </button>
            </header>
            <HoursWeekList periods={periods} />
          </>
        )}
      </article>

      <article
        className={`wiz-hours-tile${editingSpecial ? " is-editing" : ""}`}
        id="wiz-field-special-hours"
      >
        {editingSpecial ? (
          <SpecialHoursEditor
            initial={special}
            seedEmpty={seedEmptySpecial}
            onDone={exitEdit}
            onCancel={exitEdit}
          />
        ) : (
          <>
            <header className="wiz-hours-col-head">
              <h3 className="wiz-hours-tile-title">Dni specjalne</h3>
              <button
                type="button"
                className="wiz-field-edit"
                aria-label="Dodaj dzień specjalny"
                onClick={() =>
                  enterEdit("special", { seedSpecial: special.length === 0 })
                }
              >
                <Plus aria-hidden />
              </button>
            </header>
            <SpecialDaysList periods={special} />
            {upcomingHint ? (
              <div className="wiz-hours-tip" role="note">
                <span className="wiz-hours-tip-icon-wrap" aria-hidden>
                  <CircleAlert className="wiz-hours-tip-icon" />
                </span>
                <div className="wiz-hours-tip-body">
                  <p className="wiz-hours-tip-title">
                    Brak nadchodzących dni specjalnych
                  </p>
                  <p className="wiz-hours-tip-text">
                    Najbliższe święta: {upcomingHint}. Ustaw godziny, żeby
                    klienci nie trafili na zamknięte drzwi.
                  </p>
                </div>
              </div>
            ) : null}
          </>
        )}
      </article>
    </div>
  );
}

function HoursSwitch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <label className="wiz-hours-switch">
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="wiz-hours-switch-track" aria-hidden />
      <span className="wiz-hours-switch-label">{label}</span>
    </label>
  );
}

/** Tryb dnia specjalnego - ten sam segmentowy przełącznik co Tak/Nie w atrybutach. */
function SpecialModeToggle({
  closed,
  onChange,
}: {
  closed: boolean;
  onChange: (closed: boolean) => void;
}) {
  return (
    <div className="wiz-attr-toggle" role="group" aria-label="Tryb dnia">
      <button
        type="button"
        className={`wiz-attr-choice${closed ? " is-active is-no" : ""}`}
        aria-pressed={closed}
        onClick={() => onChange(true)}
      >
        Zamknięte
      </button>
      <button
        type="button"
        className={`wiz-attr-choice${closed ? "" : " is-active is-no"}`}
        aria-pressed={!closed}
        onClick={() => onChange(false)}
      >
        Inne godziny
      </button>
    </div>
  );
}

function formatHoursRange(periods: GbpPeriod[]): string {
  return periods
    .map((p) => `${formatTime(p.openTime)}-${formatTime(p.closeTime)}`)
    .join(", ");
}

function HoursWeekList({ periods }: { periods: GbpPeriod[] }) {
  if (!periods.length) {
    return (
      <p className="text-sm text-muted-foreground">Brak godzin otwarcia</p>
    );
  }

  return (
    <ul className="wiz-hours-week">
      {WEEKDAYS.map((day) => {
        const dayPeriods = periods.filter((p) => p.openDay === day.value);
        const closed = dayPeriods.length === 0;
        return (
          <li
            key={day.value}
            className={`wiz-hours-week-row${closed ? " is-closed" : ""}`}
          >
            <span className="wiz-hours-week-day">{day.label}</span>
            <span className="wiz-hours-week-value">
              {closed ? (
                <span className="wiz-hours-closed-text">Zamknięte</span>
              ) : (
                <span className="mono">{formatHoursRange(dayPeriods)}</span>
              )}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function toDateParts(date?: {
  year?: number;
  month?: number;
  day?: number;
}): { year: number; month: number; day: number } | null {
  if (!date?.year || !date?.month || !date?.day) return null;
  return { year: date.year, month: date.month, day: date.day };
}

function toJsDate(parts: { year: number; month: number; day: number }): Date {
  return new Date(parts.year, parts.month - 1, parts.day);
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function SpecialDaysList({ periods }: { periods: GbpSpecialHourPeriod[] }) {
  if (!periods.length) {
    return (
      <p className="wiz-special-empty text-sm text-muted-foreground">
        Brak dni specjalnych
      </p>
    );
  }

  const sorted = [...periods].sort((a, b) => {
    const da = toDateParts(a.startDate);
    const db = toDateParts(b.startDate);
    if (!da || !db) return 0;
    return toJsDate(da).getTime() - toJsDate(db).getTime();
  });

  const today = startOfDay(getWarsawNow().date);

  return (
    <ul className="wiz-special-list">
      {sorted.map((p, i) => {
        const parts = toDateParts(p.startDate);
        if (!parts) return null;
        const date = toJsDate(parts);
        const past = date < today;
        const weekday = new Intl.DateTimeFormat("pl-PL", {
          weekday: "long",
        }).format(date);
        const name = holidayNameFor(parts) ?? "Dzień specjalny";
        const weekdayLabel = weekday.charAt(0).toUpperCase() + weekday.slice(1);

        return (
          <li key={i} className={`wiz-special-item${past ? " is-past" : ""}`}>
            <div className="wiz-special-datebox" aria-hidden>
              <span className="wiz-special-datebox-day">{parts.day}</span>
              <span className="wiz-special-datebox-month">
                {MONTH_SHORT[parts.month - 1]}
              </span>
            </div>
            <div className="wiz-special-meta">
              <p className="wiz-special-name">{name}</p>
              <p className="wiz-special-sub">
                {weekdayLabel}, {parts.year}
                {past ? " · minione" : ""}
              </p>
            </div>
            {p.closed ? (
              <span className="ui-pill ui-pill-neutral">Zamknięte</span>
            ) : (
              <span className="mono wiz-hours-day-time">
                {`${formatTime(p.openTime)}-${formatTime(p.closeTime)}`}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function getWarsawNow(): { date: Date } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Warsaw",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";

  return {
    date: new Date(
      Number(get("year")),
      Number(get("month")) - 1,
      Number(get("day")),
    ),
  };
}

function toDateInputValue(date?: {
  year?: number;
  month?: number;
  day?: number;
}): string {
  if (!date?.year || !date?.month || !date?.day) return "";
  return `${date.year}-${String(date.month).padStart(2, "0")}-${String(date.day).padStart(2, "0")}`;
}

function parseDateInput(value: string): {
  year: number;
  month: number;
  day: number;
} | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

type WeekRow = {
  day: string;
  open: string;
  close: string;
  closed: boolean;
};

function HoursEditor({
  initial,
  onDone,
  onCancel,
}: {
  initial: GbpPeriod[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [rows, setRows] = useState<WeekRow[]>(() =>
    WEEKDAYS.map((day) => {
      const match = initial.find((p) => p.openDay === day.value);
      return {
        day: day.value,
        open: match ? formatTime(match.openTime) || "09:00" : "09:00",
        close: match ? formatTime(match.closeTime) || "17:00" : "17:00",
        closed: !match,
      };
    }),
  );

  return (
    <form
      className="wiz-hours-edit-form"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const periods = rows
          .filter((r) => !r.closed && r.open && r.close)
          .map((r) => ({
            openDay: r.day,
            closeDay: r.day,
            openTime: r.open,
            closeTime: r.close,
          }));
        startTransition(async () => {
          const result = await updateGbpRegularHours({ periods });
          if (!result.ok) {
            toast.error({ title: "Nie zapisano", description: result.error });
            return;
          }
          toast.success({ title: "Godziny zapisane w Google" });
          onDone();
          router.refresh();
        });
      }}
    >
      <header className="wiz-hours-col-head">
        <div className="wiz-hours-col-titles">
          <h3 className="wiz-hours-tile-title">Godziny otwarcia</h3>
          <p className="wiz-hours-col-sub">
            Edycja - zmiany trafią do Google po zapisaniu
          </p>
        </div>
      </header>

      <ul className="wiz-hours-edit-list">
        {rows.map((row, index) => (
          <li
            key={row.day}
            className={`wiz-hours-edit-day${row.closed ? " is-closed" : ""}`}
          >
            <span className="wiz-hours-edit-day-name">
              {WEEKDAYS.find((d) => d.value === row.day)?.label}
            </span>
            <div className="wiz-hours-edit-day-controls">
              <HoursSwitch
                checked={!row.closed}
                label={row.closed ? "Zamknięte" : "Otwarte"}
                onChange={(open) => {
                  const next = [...rows];
                  next[index] = {
                    ...row,
                    closed: !open,
                    open: row.open || "09:00",
                    close: row.close || "17:00",
                  };
                  setRows(next);
                }}
              />
              {!row.closed ? (
                <div className="wiz-hours-time-range">
                  <TimeField
                    className="wiz-hours-time"
                    ariaLabel="Otwarcie"
                    value={row.open}
                    onChange={(value) => {
                      const next = [...rows];
                      next[index] = { ...row, open: value };
                      setRows(next);
                    }}
                  />
                  <span className="wiz-hours-time-sep" aria-hidden>
                    -
                  </span>
                  <TimeField
                    className="wiz-hours-time"
                    ariaLabel="Zamknięcie"
                    value={row.close}
                    onChange={(value) => {
                      const next = [...rows];
                      next[index] = { ...row, close: value };
                      setRows(next);
                    }}
                  />
                </div>
              ) : null}
            </div>
          </li>
        ))}
      </ul>

      <div className="wiz-hours-edit-footer">
        <button
          type="button"
          className="ui-btn ui-btn-outline ui-btn-sm"
          onClick={onCancel}
          disabled={pending}
        >
          Anuluj
        </button>
        <button
          type="submit"
          className="ui-btn ui-btn-primary ui-btn-sm"
          disabled={pending}
        >
          {pending ? <Loader2 aria-hidden className="ui-btn-spinner" /> : null}
          Zapisz w Google
        </button>
      </div>
    </form>
  );
}

type SpecialRow = {
  id: string;
  date: string;
  name: string;
  open: string;
  close: string;
  closed: boolean;
};

function emptySpecialRow(): SpecialRow {
  return {
    id: crypto.randomUUID(),
    date: "",
    name: "",
    open: "09:00",
    close: "17:00",
    closed: true,
  };
}

function toSpecialRows(
  initial: GbpSpecialHourPeriod[],
  seedEmpty: boolean,
): SpecialRow[] {
  if (!initial.length) {
    return seedEmpty ? [emptySpecialRow()] : [];
  }
  return initial.map((p) => {
    const parts = toDateParts(p.startDate);
    return {
      id: crypto.randomUUID(),
      date: toDateInputValue(p.startDate),
      name: parts ? (holidayNameFor(parts) ?? "") : "",
      open: formatTime(p.openTime) || "09:00",
      close: formatTime(p.closeTime) || "17:00",
      closed: Boolean(p.closed),
    };
  });
}

function SpecialHoursEditor({
  initial,
  seedEmpty,
  onDone,
  onCancel,
}: {
  initial: GbpSpecialHourPeriod[];
  seedEmpty: boolean;
  onDone: () => void;
  onCancel: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [rows, setRows] = useState(() => toSpecialRows(initial, seedEmpty));
  const holidays = useMemo(() => upcomingHolidays(HOLIDAY_SUGGESTIONS), []);
  const takenDates = new Set(rows.map((row) => row.date));
  const holidaySuggestions = holidays.filter(
    (h) => !takenDates.has(toDateInputValue(h)),
  );

  /** Dodaje święta jako dni zamknięte; najpierw wypełnia puste wiersze. */
  function addClosedHolidays(days: Holiday[]) {
    const next = [...rows];
    for (const h of days) {
      const filled: SpecialRow = {
        ...emptySpecialRow(),
        date: toDateInputValue(h),
        name: h.name,
        closed: true,
      };
      const blank = next.findIndex((row) => !row.date);
      if (blank >= 0) next[blank] = { ...filled, id: next[blank].id };
      else next.push(filled);
    }
    setRows(next);
  }

  return (
    <form
      className="wiz-hours-edit-form"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const periods: Array<{
          startDate: { year: number; month: number; day: number };
          endDate: { year: number; month: number; day: number };
          closed: boolean;
          openTime?: string;
          closeTime?: string;
        }> = [];

        for (const row of rows) {
          const date = parseDateInput(row.date);
          if (!date) {
            toast.error({ title: "Uzupełnij datę w każdym wierszu" });
            return;
          }
          if (row.closed) {
            periods.push({
              startDate: date,
              endDate: date,
              closed: true,
            });
            continue;
          }
          if (!row.open || !row.close) {
            toast.error({ title: "Uzupełnij godziny otwarcia" });
            return;
          }
          periods.push({
            startDate: date,
            endDate: date,
            closed: false,
            openTime: row.open,
            closeTime: row.close,
          });
        }

        startTransition(async () => {
          const result = await updateGbpSpecialHours({ periods });
          if (!result.ok) {
            toast.error({ title: "Nie zapisano", description: result.error });
            return;
          }
          toast.success({ title: "Godziny specjalne zapisane w Google" });
          onDone();
          router.refresh();
        });
      }}
    >
      <header className="wiz-hours-col-head">
        <div className="wiz-hours-col-titles">
          <h3 className="wiz-hours-tile-title">Dni specjalne</h3>
          <p className="wiz-hours-col-sub">
            Święta i wyjątki od standardowych godzin
          </p>
        </div>
      </header>

      <ul className="wiz-special-edit-list">
        {rows.map((row, index) => (
          <li key={row.id} className="wiz-special-edit-card">
            <div className="wiz-special-edit-top">
              <input
                className="ui-field"
                type="date"
                aria-label="Data"
                value={row.date}
                onChange={(e) => {
                  const date = parseDateInput(e.target.value);
                  const next = [...rows];
                  next[index] = {
                    ...row,
                    date: e.target.value,
                    name: date ? (holidayNameFor(date) ?? row.name) : row.name,
                  };
                  setRows(next);
                }}
              />
              <input
                className="ui-field"
                type="text"
                aria-label="Nazwa"
                placeholder="Nazwa (np. Wielkanoc)"
                value={row.name}
                onChange={(e) => {
                  const next = [...rows];
                  next[index] = { ...row, name: e.target.value };
                  setRows(next);
                }}
              />
              <button
                type="button"
                className="ui-btn ui-btn-ghost ui-btn-sm wiz-special-remove"
                aria-label="Usuń dzień"
                onClick={() => setRows(rows.filter((_, i) => i !== index))}
              >
                <Trash2 aria-hidden />
              </button>
            </div>
            <div className="wiz-special-edit-bottom">
              <SpecialModeToggle
                closed={row.closed}
                onChange={(closed) => {
                  const next = [...rows];
                  next[index] = { ...row, closed };
                  setRows(next);
                }}
              />
              {row.closed ? (
                <span className="wiz-special-edit-note">
                  Nieczynne cały dzień
                </span>
              ) : (
                <div className="wiz-hours-time-range">
                  <TimeField
                    className="wiz-hours-time"
                    ariaLabel="Otwarcie"
                    value={row.open}
                    onChange={(value) => {
                      const next = [...rows];
                      next[index] = { ...row, open: value };
                      setRows(next);
                    }}
                  />
                  <span className="wiz-hours-time-sep" aria-hidden>
                    -
                  </span>
                  <TimeField
                    className="wiz-hours-time"
                    ariaLabel="Zamknięcie"
                    value={row.close}
                    onChange={(value) => {
                      const next = [...rows];
                      next[index] = { ...row, close: value };
                      setRows(next);
                    }}
                  />
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>

      <button
        type="button"
        className="wiz-special-add"
        onClick={() => setRows([...rows, emptySpecialRow()])}
      >
        <Plus aria-hidden />
        Dodaj dzień specjalny
      </button>

      {holidaySuggestions.length ? (
        <div className="wiz-special-suggest">
          <div className="wiz-special-suggest-head">
            <p className="wiz-special-suggest-title">
              Propozycje dni zamkniętych
            </p>
            {holidaySuggestions.length > 1 ? (
              <button
                type="button"
                className="wiz-special-suggest-all"
                onClick={() => addClosedHolidays(holidaySuggestions)}
              >
                Dodaj wszystkie
              </button>
            ) : null}
          </div>
          <ul className="wiz-special-suggest-list">
            {holidaySuggestions.map((h) => (
              <li key={toDateInputValue(h)}>
                <button
                  type="button"
                  className="wiz-special-chip"
                  onClick={() => addClosedHolidays([h])}
                >
                  <Plus aria-hidden />
                  <span className="wiz-special-chip-date mono">
                    {h.day} {MONTH_SHORT[h.month - 1].toLowerCase()}
                  </span>
                  {h.name}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="wiz-hours-edit-footer">
        <button
          type="button"
          className="ui-btn ui-btn-outline ui-btn-sm"
          onClick={onCancel}
          disabled={pending}
        >
          Anuluj
        </button>
        <button
          type="submit"
          className="ui-btn ui-btn-primary ui-btn-sm"
          disabled={pending}
        >
          {pending ? <Loader2 aria-hidden className="ui-btn-spinner" /> : null}
          Zapisz w Google
        </button>
      </div>
    </form>
  );
}
