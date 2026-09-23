"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2, Pencil, X } from "lucide-react";
import { toast } from "gooey-toast";
import {
  updateGbpAttribute,
  updateGbpRegularHours,
} from "@/features/wizytowka/actions";
import {
  WEEKDAYS,
  formatTime,
  type GbpLocation,
  type GbpPeriod,
} from "@/features/wizytowka/types";
import type { GbpAttributeMetadata } from "@/lib/integrations/gbp/client";

export function GodzinyAtrybutyView({
  location,
  attributes,
  attributeMetadata,
}: {
  location: GbpLocation;
  attributes: Array<Record<string, unknown>>;
  attributeMetadata: GbpAttributeMetadata[];
}) {
  return (
    <div className="wiz-stack">
      <HoursSection location={location} />
      <AttributesSection
        attributes={attributes}
        attributeMetadata={attributeMetadata}
      />
    </div>
  );
}

function HoursSection({ location }: { location: GbpLocation }) {
  const [editing, setEditing] = useState(false);
  const periods = location.regularHours?.periods ?? [];

  return (
    <div>
      <div className="wiz-section-head">
        <h2 className="text-base font-semibold">Godziny otwarcia</h2>
        <button
          type="button"
          className="ui-btn ui-btn-ghost ui-btn-sm"
          onClick={() => setEditing((v) => !v)}
        >
          {editing ? <X aria-hidden /> : <Pencil aria-hidden />}
          {editing ? "Zamknij" : "Edytuj"}
        </button>
      </div>
      {editing ? (
        <HoursEditor
          initial={periods}
          onDone={() => setEditing(false)}
        />
      ) : (
        <ul className="wiz-hours-list">
          {WEEKDAYS.map((day) => {
            const dayPeriods = periods.filter((p) => p.openDay === day.value);
            return (
              <li key={day.value} className="wiz-hours-row">
                <span>{day.label}</span>
                <span className="mono">
                  {dayPeriods.length
                    ? dayPeriods
                        .map(
                          (p) =>
                            `${formatTime(p.openTime)}-${formatTime(p.closeTime)}`,
                        )
                        .join(", ")
                    : "Zamknięte"}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {location.specialHours?.specialHourPeriods?.length ? (
        <div className="mt-4">
          <h3 className="text-sm font-semibold">Godziny specjalne</h3>
          <ul className="wiz-hours-list mt-2">
            {location.specialHours.specialHourPeriods.map((p, i) => (
              <li key={i} className="wiz-hours-row">
                <span className="mono">
                  {p.startDate?.year}-{p.startDate?.month}-{p.startDate?.day}
                </span>
                <span>
                  {p.closed
                    ? "Zamknięte"
                    : `${formatTime(p.openTime)}-${formatTime(p.closeTime)}`}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function HoursEditor({
  initial,
  onDone,
}: {
  initial: GbpPeriod[];
  onDone: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [rows, setRows] = useState(
    WEEKDAYS.map((day) => {
      const match = initial.find((p) => p.openDay === day.value);
      return {
        day: day.value,
        open: match ? formatTime(match.openTime) || "09:00" : "",
        close: match ? formatTime(match.closeTime) || "17:00" : "",
        closed: !match,
      };
    }),
  );

  return (
    <form
      className="wiz-edit-form"
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
      <ul className="wiz-hours-edit">
        {rows.map((row, index) => (
          <li key={row.day} className="wiz-hours-edit-row">
            <span>{WEEKDAYS.find((d) => d.value === row.day)?.label}</span>
            <label className="ui-check-label">
              <input
                type="checkbox"
                className="ui-check"
                checked={row.closed}
                onChange={(e) => {
                  const next = [...rows];
                  next[index] = { ...row, closed: e.target.checked };
                  setRows(next);
                }}
              />
              Zamknięte
            </label>
            {!row.closed ? (
              <>
                <input
                  className="ui-field"
                  type="time"
                  value={row.open}
                  onChange={(e) => {
                    const next = [...rows];
                    next[index] = { ...row, open: e.target.value };
                    setRows(next);
                  }}
                />
                <input
                  className="ui-field"
                  type="time"
                  value={row.close}
                  onChange={(e) => {
                    const next = [...rows];
                    next[index] = { ...row, close: e.target.value };
                    setRows(next);
                  }}
                />
              </>
            ) : null}
          </li>
        ))}
      </ul>
      <button
        type="submit"
        className="ui-btn ui-btn-primary ui-btn-sm"
        disabled={pending}
      >
        {pending ? <Loader2 aria-hidden className="ui-btn-spinner" /> : null}
        Zapisz w Google
      </button>
    </form>
  );
}

function AttributesSection({
  attributes,
  attributeMetadata,
}: {
  attributes: Array<Record<string, unknown>>;
  attributeMetadata: GbpAttributeMetadata[];
}) {
  const filled = new Map(
    attributes
      .filter((a) => typeof a.name === "string")
      .map((a) => [a.name as string, a]),
  );

  const facts = attributeMetadata.filter((m) => !filled.has(m.parent));
  const confirmed = attributeMetadata.filter((m) => filled.has(m.parent));

  return (
    <div>
      <h2 className="text-base font-semibold">Atrybuty</h2>
      <p className="locked-note mt-1">
        Potwierdzaj fakty pojedynczo - nie ma akceptacji hurtowej.
      </p>

      {facts.length > 0 ? (
        <div className="mt-4">
          <h3 className="text-sm font-semibold">Fakty do potwierdzenia</h3>
          <ul className="wiz-facts-list">
            {facts.map((meta) => (
              <FactRow key={meta.parent} meta={meta} />
            ))}
          </ul>
        </div>
      ) : (
        <p className="locked-note mt-3">Brak niewypełnionych atrybutów.</p>
      )}

      {confirmed.length > 0 ? (
        <div className="mt-4">
          <h3 className="text-sm font-semibold">Ustawione</h3>
          <ul className="wiz-attr-list">
            {confirmed.map((meta) => {
              const attr = filled.get(meta.parent);
              return (
                <li key={meta.parent} className="wiz-attr-row">
                  <span>{meta.displayName ?? meta.parent}</span>
                  <span className="mono text-sm text-muted-foreground">
                    {JSON.stringify(attr?.values ?? attr?.valueType ?? "")}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function FactRow({ meta }: { meta: GbpAttributeMetadata }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const isBool = meta.valueType === "BOOL" || !meta.valueType;

  return (
    <li className="wiz-fact-row">
      <div>
        <span className="ui-pill ui-pill-warn">Fakt do potwierdzenia</span>
        <p className="mt-1 font-medium">{meta.displayName ?? meta.parent}</p>
        {meta.groupDisplayName ? (
          <p className="text-sm text-muted-foreground">{meta.groupDisplayName}</p>
        ) : null}
      </div>
      {isBool ? (
        <div className="wiz-fact-actions">
          <button
            type="button"
            className="ui-btn ui-btn-primary ui-btn-sm"
            disabled={pending}
            onClick={() => {
              startTransition(async () => {
                const result = await updateGbpAttribute({
                  attributeName: meta.parent,
                  valueType: "BOOL",
                  values: [true],
                });
                if (!result.ok) {
                  toast.error({
                    title: "Nie zapisano atrybutu",
                    description: result.error,
                  });
                  return;
                }
                toast.success({ title: "Atrybut zapisany w Google" });
                router.refresh();
              });
            }}
          >
            {pending ? <Loader2 aria-hidden className="ui-btn-spinner" /> : null}
            Tak, to prawda
          </button>
        </div>
      ) : (
        <div className="wiz-fact-actions">
          {(meta.valueMetadata ?? []).map((opt) => (
            <button
              key={String(opt.value)}
              type="button"
              className="ui-btn ui-btn-outline ui-btn-sm"
              disabled={pending}
              onClick={() => {
                startTransition(async () => {
                  const result = await updateGbpAttribute({
                    attributeName: meta.parent,
                    valueType: meta.valueType,
                    values: [opt.value ?? ""],
                  });
                  if (!result.ok) {
                    toast.error({
                      title: "Nie zapisano atrybutu",
                      description: result.error,
                    });
                    return;
                  }
                  toast.success({ title: "Atrybut zapisany w Google" });
                  router.refresh();
                });
              }}
            >
              {opt.displayName ?? String(opt.value)}
            </button>
          ))}
        </div>
      )}
    </li>
  );
}
