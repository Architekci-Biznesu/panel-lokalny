"use client";

import { Clock } from "lucide-react";
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
const HOURS = Array.from({ length: 24 }, (_, i) => pad(i));
const MINUTE_STEP = 5;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function splitTime(value: string): { hour: string; minute: string } {
  const match = /^(\d{2}):(\d{2})/.exec(value);
  return match
    ? { hour: match[1], minute: match[2] }
    : { hour: "09", minute: "00" };
}

/** Minuty co 5; nietypowa obecna wartość (np. 07) też jest na liście. */
function minuteOptions(current: string): string[] {
  const list = Array.from({ length: 60 / MINUTE_STEP }, (_, i) =>
    pad(i * MINUTE_STEP),
  );
  if (!list.includes(current)) list.push(current);
  return list.sort();
}

/**
 * Pole godziny (HH:MM) w stylu panelu zamiast natywnego input[type=time].
 * Dropdown z kolumnami godzin i minut w portalu z pozycją fixed, więc nie ucina
 * go overflow kafla; otwiera się w górę, gdy pod polem brakuje miejsca.
 * Wybór minuty zamyka listę.
 */
export function TimeField({
  value,
  onChange,
  ariaLabel,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [style, setStyle] = useState<CSSProperties>({ visibility: "hidden" });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const { hour, minute } = splitTime(value);

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
    if (!open) return;
    place();
    // Zaznaczona godzina i minuta na środku kolumn (bez przewijania strony).
    panelRef.current
      ?.querySelectorAll<HTMLElement>(".ui-time-list")
      .forEach((list) => {
        const active = list.querySelector<HTMLElement>(".is-active");
        if (!active) return;
        list.scrollTop =
          active.offsetTop - list.clientHeight / 2 + active.offsetHeight / 2;
      });
    panelRef.current
      ?.querySelector<HTMLElement>(".ui-time-opt.is-active")
      ?.focus({ preventScroll: true });
  }, [open, place]);

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

  function close() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`ui-field ui-time-field${open ? " is-open" : ""}${className ? ` ${className}` : ""}`}
        aria-label={`${ariaLabel}: ${hour}:${minute}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="mono">
          {hour}:{minute}
        </span>
        <Clock aria-hidden />
      </button>

      {open
        ? createPortal(
            <div
              ref={panelRef}
              className="ui-time-pop"
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
              <TimeColumn
                label="Godz."
                options={HOURS}
                selected={hour}
                onPick={(h) => onChange(`${h}:${minute}`)}
              />
              <TimeColumn
                label="Min."
                options={minuteOptions(minute)}
                selected={minute}
                onPick={(m) => {
                  onChange(`${hour}:${m}`);
                  close();
                }}
              />
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

function TimeColumn({
  label,
  options,
  selected,
  onPick,
}: {
  label: string;
  options: string[];
  selected: string;
  onPick: (value: string) => void;
}) {
  return (
    <div className="ui-time-col">
      <p className="ui-time-col-label">{label}</p>
      <ul className="ui-time-list" role="listbox" aria-label={label}>
        {options.map((option) => (
          <li key={option} role="presentation">
            <button
              type="button"
              role="option"
              aria-selected={option === selected}
              className={`ui-time-opt mono${option === selected ? " is-active" : ""}`}
              onClick={() => onPick(option)}
            >
              {option}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
