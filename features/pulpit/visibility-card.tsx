"use client";

import { useMemo, useState } from "react";
import { Eye } from "lucide-react";
import { UiSelect } from "@/features/shell/ui-select";
import type { PulpitVisibility } from "@/features/pulpit/load-pulpit";
import { formatIntPl } from "@/features/wizytowka/performance";

const PERIOD_OPTIONS = [
  { value: "week", label: "Tydzień" },
  // TODO Styl 4: inne okresy, gdy loader będzie je wspierał
];

export function VisibilityCard({
  visibility,
}: {
  visibility: PulpitVisibility | null;
}) {
  const [period, setPeriod] = useState("week");
  const days = visibility?.days ?? [];
  const todayIso = useMemo(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }, []);
  const [activeDate, setActiveDate] = useState<string | null>(null);
  const selected =
    activeDate ??
    days.find((d) => d.date === todayIso)?.date ??
    days.find((d) => d.value > 0)?.date ??
    days[0]?.date ??
    null;
  const max = Math.max(1, ...days.map((d) => d.value));
  const change = visibility?.changePct ?? null;
  const changeLabel =
    change == null
      ? "-"
      : `${change >= 0 ? "+" : ""}${Math.round(change).toLocaleString("pl-PL")}%`;

  return (
    <section className="pulpit-card pulpit-visibility">
      <header className="pulpit-visibility-head">
        <div className="pulpit-visibility-title-row">
          <span className="pulpit-icon-circle" aria-hidden>
            <Eye />
          </span>
          <div>
            <h2 className="pulpit-card-title is-lg">Widoczność wizytówki</h2>
            <p className="pulpit-card-lead">
              Wyświetlenia wizytówki w Google dzień po dniu. Najedź na dzień,
              żeby zobaczyć szczegóły.
            </p>
          </div>
        </div>
        <UiSelect
          aria-label="Okres"
          value={period}
          options={PERIOD_OPTIONS}
          onChange={setPeriod}
        />
      </header>

      {!visibility || days.every((d) => d.value === 0) ? (
        <p className="pulpit-empty">
          Brak danych o wyświetleniach w tym tygodniu.
        </p>
      ) : (
        <div className="pulpit-visibility-body">
          <div className="pulpit-visibility-change">
            <p className="pulpit-visibility-pct mono">{changeLabel}</p>
            <p className="pulpit-card-lead">Ten tydzień vs poprzedni</p>
          </div>

          <div className="pulpit-lollipop" role="img" aria-label="Wykres tygodnia">
            {days.map((day) => {
              const isActive = day.date === selected;
              const height = `${Math.max(8, (day.value / max) * 100)}%`;
              return (
                <button
                  key={day.date}
                  type="button"
                  className={`pulpit-lollipop-col${isActive ? " is-active" : ""}`}
                  onMouseEnter={() => setActiveDate(day.date)}
                  onFocus={() => setActiveDate(day.date)}
                  onClick={() => setActiveDate(day.date)}
                >
                  {isActive ? (
                    <span className="pulpit-lollipop-tip mono">
                      {formatIntPl(day.value)}
                    </span>
                  ) : (
                    <span className="pulpit-lollipop-tip-spacer" aria-hidden />
                  )}
                  <span className="pulpit-lollipop-stem-wrap">
                    <span
                      className="pulpit-lollipop-stem"
                      style={{ height }}
                    >
                      <span className="pulpit-lollipop-dot" />
                    </span>
                  </span>
                  <span className="pulpit-lollipop-day">{day.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
