"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Loader2, Pencil, X } from "lucide-react";
import { toast } from "gooey-toast";
import { updateGbpAttributesBatch } from "@/features/wizytowka/actions";
import {
  attributeId,
  groupFactsByGroup,
  parseAttributeValues,
} from "@/features/wizytowka/attributes";
import { UiSelect } from "@/features/shell/ui-select";
import type { GbpAttributeMetadata } from "@/lib/integrations/gbp/client";

type AttrDraft =
  | { valueType: "BOOL"; boolValue: boolean }
  | { valueType: "ENUM"; enumValue: string; clear?: boolean }
  | {
      valueType: "REPEATED_ENUM";
      setValues: string[];
      unsetValues: string[];
    };

export function AtrybutyView({
  attributes,
  attributeMetadata,
}: {
  attributes: Array<Record<string, unknown>>;
  attributeMetadata: GbpAttributeMetadata[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [drafts, setDrafts] = useState<Record<string, AttrDraft>>({});
  const values = parseAttributeValues(attributes, attributeMetadata);
  const groups = groupFactsByGroup(attributeMetadata);
  const dirtyCount = Object.keys(drafts).length;
  const dirty = dirtyCount > 0;

  const draftList = useMemo(() => Object.entries(drafts), [drafts]);

  function setDraft(name: string, draft: AttrDraft | null) {
    setDrafts((prev) => {
      const next = { ...prev };
      if (!draft) delete next[name];
      else next[name] = draft;
      return next;
    });
  }

  function closeEdit() {
    setDrafts({});
    setOpen(false);
  }

  function saveDrafts() {
    if (!dirtyCount) return;
    const payload = draftList.map(([attributeName, draft]) => {
      if (draft.valueType === "BOOL") {
        return {
          attributeName,
          valueType: "BOOL" as const,
          boolValue: draft.boolValue,
        };
      }
      if (draft.valueType === "ENUM") {
        return draft.clear
          ? {
              attributeName,
              valueType: "ENUM" as const,
              clear: true,
            }
          : {
              attributeName,
              valueType: "ENUM" as const,
              enumValue: draft.enumValue,
            };
      }
      return {
        attributeName,
        valueType: "REPEATED_ENUM" as const,
        repeatedEnum: {
          setValues: draft.setValues,
          unsetValues: draft.unsetValues,
        },
      };
    });

    startTransition(async () => {
      const result = await updateGbpAttributesBatch(payload);
      if (!result.ok) {
        toast.error({
          title: "Nie zapisano atrybutów",
          description: result.error,
        });
        return;
      }
      toast.success({
        title: "Atrybuty zapisane w Google",
        description: dirtyCount === 1 ? "1 zmiana" : `${dirtyCount} zmian`,
      });
      setDrafts({});
      setOpen(false);
      router.refresh();
    });
  }

  if (groups.length === 0) {
    return (
      <div className="wiz-stack">
        <div className="wiz-tab-head">
          <div className="wiz-tab-head-text">
            <h2 className="text-lg font-semibold">Atrybuty</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Potwierdź fakty o firmie Tak / Nie.
            </p>
          </div>
        </div>
        <div className="wiz-fields">
          <p className="locked-note wiz-tab-note">
            Brak atrybutów dla tej kategorii wizytówki.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="wiz-stack">
      <div className="wiz-tab-head">
        <div className="wiz-tab-head-text">
          <h2 className="text-lg font-semibold">Atrybuty</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {open
              ? "Edycja - po zmianach zapisz zbiorczo na dole"
              : "Potwierdź fakty o firmie. Ołówek otwiera edycję - zapis zbiorczy na dole."}
          </p>
        </div>
        {open ? (
          <button
            type="button"
            className="ui-btn ui-btn-ghost ui-btn-sm wiz-tab-head-edit"
            aria-label="Anuluj edycję atrybutów"
            onClick={closeEdit}
          >
            <X aria-hidden />
          </button>
        ) : (
          <button
            type="button"
            className="ui-btn ui-btn-ghost ui-btn-sm wiz-tab-head-edit"
            aria-label="Edytuj atrybuty"
            onClick={() => setOpen(true)}
          >
            <Pencil aria-hidden />
          </button>
        )}
      </div>

      <div className={`wiz-fields${open ? " is-editing is-dirty" : ""}`}>
        <div className="wiz-attr-scroll">
          {groups.map(({ group, items }) => (
            <section key={group} className="wiz-attr-group">
              <h3 className="wiz-field-label wiz-attr-group-title">{group}</h3>
              <ul className="wiz-attr-list">
                {items.map((meta) => {
                  const id = attributeId(meta.parent);
                  const current = values.get(id);
                  const type = (meta.valueType ?? "BOOL").toUpperCase();
                  const draft = drafts[meta.parent];

                  if (type === "ENUM") {
                    const base =
                      current?.valueType === "ENUM" ? current.enumValue : null;
                    const value =
                      draft?.valueType === "ENUM"
                        ? draft.clear
                          ? null
                          : draft.enumValue
                        : base;
                    return (
                      <EnumAttrRow
                        key={meta.parent}
                        meta={meta}
                        value={value}
                        editing={open}
                        onChange={(next) => {
                          if (next === (base ?? null)) {
                            setDraft(meta.parent, null);
                            return;
                          }
                          if (!next) {
                            setDraft(meta.parent, {
                              valueType: "ENUM",
                              enumValue: "",
                              clear: true,
                            });
                            return;
                          }
                          setDraft(meta.parent, {
                            valueType: "ENUM",
                            enumValue: next,
                          });
                        }}
                      />
                    );
                  }

                  if (type === "REPEATED_ENUM") {
                    const baseSet =
                      current?.valueType === "REPEATED_ENUM"
                        ? current.setValues
                        : [];
                    const baseUnset =
                      current?.valueType === "REPEATED_ENUM"
                        ? current.unsetValues
                        : [];
                    const setValues =
                      draft?.valueType === "REPEATED_ENUM"
                        ? draft.setValues
                        : baseSet;
                    const unsetValues =
                      draft?.valueType === "REPEATED_ENUM"
                        ? draft.unsetValues
                        : baseUnset;
                    return (
                      <RepeatedEnumAttrBlock
                        key={meta.parent}
                        meta={meta}
                        setValues={setValues}
                        unsetValues={unsetValues}
                        editing={open}
                        onChange={(nextSet, nextUnset) => {
                          const same =
                            sameStringSet(nextSet, baseSet) &&
                            sameStringSet(nextUnset, baseUnset);
                          if (same) {
                            setDraft(meta.parent, null);
                            return;
                          }
                          setDraft(meta.parent, {
                            valueType: "REPEATED_ENUM",
                            setValues: nextSet,
                            unsetValues: nextUnset,
                          });
                        }}
                      />
                    );
                  }

                  const base =
                    current?.valueType === "BOOL" ? current.bool : null;
                  const value =
                    draft?.valueType === "BOOL" ? draft.boolValue : base;
                  return (
                    <BoolAttrRow
                      key={meta.parent}
                      meta={meta}
                      value={value}
                      editing={open}
                      onChange={(boolValue) => {
                        if (boolValue === base) {
                          setDraft(meta.parent, null);
                          return;
                        }
                        setDraft(meta.parent, {
                          valueType: "BOOL",
                          boolValue,
                        });
                      }}
                    />
                  );
                })}
              </ul>
            </section>
          ))}
        </div>

        {open ? (
          <div className="wiz-services-sticky">
            <p className="wiz-attr-sticky-hint">
              {dirtyCount === 0
                ? "Wybierz opcje, potem zapisz"
                : dirtyCount === 1
                  ? "1 niezapisana zmiana"
                  : `${dirtyCount} niezapisanych zmian`}
            </p>
            <div className="wiz-services-sticky-actions">
              <button
                type="button"
                className="ui-btn ui-btn-outline ui-btn-sm"
                disabled={pending}
                onClick={closeEdit}
              >
                Anuluj
              </button>
              <button
                type="button"
                className="ui-btn ui-btn-primary ui-btn-sm"
                disabled={pending || !dirty}
                onClick={saveDrafts}
              >
                {pending ? (
                  <Loader2 aria-hidden className="ui-btn-spinner" />
                ) : null}
                Zapisz w Google
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function sameStringSet(a: string[], b: string[]) {
  if (a.length !== b.length) return false;
  const setB = new Set(b);
  return a.every((v) => setB.has(v));
}

function displayBool(value: boolean | null) {
  if (value === true) return "Tak";
  if (value === false) return "Nie";
  return "Brak";
}

function BoolAttrRow({
  meta,
  value,
  editing,
  onChange,
}: {
  meta: GbpAttributeMetadata;
  value: boolean | null;
  editing: boolean;
  onChange: (value: boolean) => void;
}) {
  const label = meta.displayName ?? attributeId(meta.parent);

  return (
    <li className="wiz-attr-row">
      <span className="wiz-field-content">{label}</span>
      {editing ? (
        <YesNoToggle
          value={value}
          onYes={() => onChange(true)}
          onNo={() => onChange(false)}
        />
      ) : (
        <span className="wiz-field-content wiz-attr-value">
          {displayBool(value)}
        </span>
      )}
    </li>
  );
}

function EnumAttrRow({
  meta,
  value,
  editing,
  onChange,
}: {
  meta: GbpAttributeMetadata;
  value: string | null;
  editing: boolean;
  onChange: (value: string | null) => void;
}) {
  const label = meta.displayName ?? attributeId(meta.parent);
  const options = [
    { value: "", label: "Nie ustawiono" },
    ...(meta.valueMetadata ?? [])
      .filter((opt) => opt.value != null)
      .map((opt) => ({
        value: String(opt.value),
        label: opt.displayName ?? String(opt.value),
      })),
  ];
  const display =
    options.find((o) => o.value === (value ?? ""))?.label ||
    value ||
    "Brak";

  return (
    <li className="wiz-attr-row">
      <span className="wiz-field-content">{label}</span>
      {editing ? (
        <div className="wiz-attr-control">
          <UiSelect
            aria-label={label}
            value={value ?? ""}
            options={options}
            onChange={(next) => onChange(next || null)}
          />
        </div>
      ) : (
        <span className="wiz-field-content wiz-attr-value">
          {value ? display : "Brak"}
        </span>
      )}
    </li>
  );
}

function RepeatedEnumAttrBlock({
  meta,
  setValues,
  unsetValues,
  editing,
  onChange,
}: {
  meta: GbpAttributeMetadata;
  setValues: string[];
  unsetValues: string[];
  editing: boolean;
  onChange: (setValues: string[], unsetValues: string[]) => void;
}) {
  const set = new Set(setValues);
  const unset = new Set(unsetValues);
  const label = meta.displayName ?? attributeId(meta.parent);
  const options = (meta.valueMetadata ?? []).filter((opt) => opt.value != null);

  if (options.length === 0) return null;

  return (
    <li className="wiz-attr-repeated">
      <p className="wiz-field-label wiz-attr-repeated-title">{label}</p>
      <ul className="wiz-attr-list">
        {options.map((opt) => {
          const optId = String(opt.value);
          const state = set.has(optId)
            ? true
            : unset.has(optId)
              ? false
              : null;
          return (
            <li key={optId} className="wiz-attr-row">
              <span className="wiz-field-content">
                {opt.displayName ?? optId}
              </span>
              {editing ? (
                <YesNoToggle
                  value={state}
                  onYes={() => {
                    const nextSet = new Set(setValues);
                    const nextUnset = new Set(unsetValues);
                    nextSet.delete(optId);
                    nextUnset.delete(optId);
                    nextSet.add(optId);
                    onChange([...nextSet], [...nextUnset]);
                  }}
                  onNo={() => {
                    const nextSet = new Set(setValues);
                    const nextUnset = new Set(unsetValues);
                    nextSet.delete(optId);
                    nextUnset.delete(optId);
                    nextUnset.add(optId);
                    onChange([...nextSet], [...nextUnset]);
                  }}
                />
              ) : (
                <span className="wiz-field-content wiz-attr-value">
                  {displayBool(state)}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </li>
  );
}

function YesNoToggle({
  value,
  onYes,
  onNo,
}: {
  value: boolean | null;
  onYes: () => void;
  onNo: () => void;
}) {
  return (
    <div className="wiz-attr-toggle" role="group">
      <button
        type="button"
        className={`wiz-attr-choice ${value === true ? "is-active is-yes" : ""}`}
        aria-pressed={value === true}
        onClick={onYes}
      >
        Tak
      </button>
      <button
        type="button"
        className={`wiz-attr-choice ${value === false ? "is-active is-no" : ""}`}
        aria-pressed={value === false}
        onClick={onNo}
      >
        Nie
      </button>
    </div>
  );
}
