"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, Search, X } from "lucide-react";

type Option = { name: string; displayName: string };

type Props = {
  value: string[];
  options: Option[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  /** When true, selecting replaces the single value instead of toggling multi. */
  single?: boolean;
};

function labelFor(name: string, options: Option[]) {
  return (
    options.find((o) => o.name === name)?.displayName ??
    name
      .replace(/^categories\//, "")
      .replace(/^gcid:/, "")
      .replace(/_/g, " ")
  );
}

export function CategorySearchPicker({
  value,
  options,
  onChange,
  placeholder = "Szukaj kategorii…",
  single = false,
}: Props) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const selected = new Set(value);
  const q = query.toLowerCase().trim();

  const filtered = useMemo(() => {
    const selectedSet = new Set(value);
    if (!q) {
      return value
        .map((name) => {
          const fromOptions = options.find((o) => o.name === name);
          return (
            fromOptions ?? {
              name,
              displayName: labelFor(name, options),
            }
          );
        })
        .slice(0, 40);
    }

    const matches = options.filter(
      (o) =>
        o.displayName.toLowerCase().includes(q) ||
        o.name.toLowerCase().includes(q),
    );
    matches.sort((a, b) => {
      const aSel = selectedSet.has(a.name) ? 0 : 1;
      const bSel = selectedSet.has(b.name) ? 0 : 1;
      if (aSel !== bSel) return aSel - bSel;
      return a.displayName.localeCompare(b.displayName, "pl");
    });
    return matches.slice(0, 40);
  }, [options, q, value]);

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

  function pick(name: string) {
    if (single) {
      onChange([name]);
      setOpen(false);
      setQuery("");
      return;
    }
    if (selected.has(name)) {
      onChange(value.filter((n) => n !== name));
    } else {
      onChange([...value, name]);
    }
  }

  function remove(name: string) {
    onChange(value.filter((n) => n !== name));
  }

  return (
    <div className="wiz-cat-picker" ref={rootRef}>
      <div className="ui-select-root">
        <div className="ui-search">
          <Search aria-hidden className="ui-search-icon" />
          <input
            type="search"
            className="ui-field ui-search-input"
            value={query}
            placeholder={placeholder}
            role="combobox"
            aria-autocomplete="list"
            aria-controls={listId}
            aria-expanded={open}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
          />
        </div>

        {open ? (
          <ul id={listId} className="ui-select-menu" role="listbox">
            {!q && filtered.length === 0 ? (
              <li className="ui-select-empty">
                Wpisz nazwę, aby wyszukać w katalogu Google
              </li>
            ) : filtered.length === 0 ? (
              <li className="ui-select-empty">Brak wyników</li>
            ) : (
              <>
                {!q ? <li className="ui-select-group-label">Wybrane</li> : null}
                {filtered.map((option) => {
                  const isSelected = selected.has(option.name);
                  return (
                    <li key={option.name} role="presentation">
                      <button
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        className={`ui-select-option${isSelected ? " is-selected" : ""}`}
                        onClick={() => pick(option.name)}
                      >
                        <span>{option.displayName}</span>
                        {isSelected ? <Check aria-hidden /> : null}
                      </button>
                    </li>
                  );
                })}
                {!q ? (
                  <li className="ui-select-empty">
                    Zacznij pisać, aby dodać kolejne
                  </li>
                ) : null}
              </>
            )}
          </ul>
        ) : null}
      </div>

      {value.length > 0 ? (
        <ul className="wiz-cat-picker-chips">
          {value.map((name) => (
            <li key={name}>
              <span className="ui-pill ui-pill-neutral wiz-cat-picker-chip">
                <span>{labelFor(name, options)}</span>
                <button
                  type="button"
                  className="wiz-cat-picker-remove"
                  aria-label={`Usuń: ${labelFor(name, options)}`}
                  onClick={() => remove(name)}
                >
                  <X aria-hidden />
                </button>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="wiz-cat-edit-hint">Brak wybranych kategorii</p>
      )}
    </div>
  );
}
