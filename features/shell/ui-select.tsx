"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

export type UiSelectOption = {
  value: string;
  label: string;
};

type UiSelectProps = {
  id?: string;
  value: string;
  options: UiSelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  "aria-label"?: string;
};

export function UiSelect({
  id,
  value,
  options,
  onChange,
  disabled = false,
  placeholder = "Wybierz…",
  "aria-label": ariaLabel,
}: UiSelectProps) {
  const autoId = useId();
  const selectId = id ?? autoId;
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);

  useEffect(() => {
    if (!open) return;
    function onDoc(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
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

  return (
    <div className="ui-select-root" ref={rootRef}>
      <button
        type="button"
        id={selectId}
        className="ui-select"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => {
          if (!disabled) setOpen((v) => !v);
        }}
      >
        <span className="ui-select-value">
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown aria-hidden className="ui-select-chevron" />
      </button>

      {open ? (
        <ul
          className="ui-menu ui-select-menu"
          role="listbox"
          aria-labelledby={selectId}
        >
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <li key={option.value} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  className={`ui-menu-item${isSelected ? " is-selected" : ""}`}
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                >
                  <span>{option.label}</span>
                  {isSelected ? (
                    <Check aria-hidden className="ui-menu-check" />
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
