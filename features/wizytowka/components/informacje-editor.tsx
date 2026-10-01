"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2, Pencil, Star, X } from "lucide-react";
import { toast } from "@/lib/toast";
import {
  updateGbpCategories,
  updateGbpDescription,
  updateGbpOpenInfo,
  updateGbpTitle,
  updateGbpWebsite,
} from "@/features/wizytowka/actions";
import { GoogleFieldNote } from "@/features/wizytowka/components/google-changes";
import type { GoogleField } from "@/features/wizytowka/google-updates";
import { listFingerprint } from "@/features/wizytowka/fingerprint";
import { useReportWizEditing } from "@/features/wizytowka/components/wiz-editing";
import { InlineSuggestion } from "@/features/wizytowka/components/inline-suggestion";
import { CategoriesSuggestion } from "@/features/wizytowka/components/categories-suggestion";
import { LocationNapFields } from "@/features/wizytowka/components/location-nap-fields";
import {
  formatOpeningDate,
  type GbpLocation,
} from "@/features/wizytowka/types";
import type { GbpSuggestion } from "@/lib/db/schema";
import { UiSelect } from "@/features/shell/ui-select";

type Props = {
  location: GbpLocation;
  categoryOptions: Array<{ name: string; displayName: string }>;
  suggestions?: GbpSuggestion[];
};

export function InformacjeEditor({
  location,
  categoryOptions,
  suggestions = [],
}: Props) {
  const primary = location.categories?.primaryCategory;
  const additional = location.categories?.additionalCategories ?? [];

  const byField = new Map(suggestions.map((s) => [s.field, s]));
  const primarySuggestion = byField.get("primary_category");
  const additionalSuggestion = byField.get("additional_categories");

  return (
    <div className="wiz-fields">
      <FieldRow
        label="Nazwa firmy"
        anchorId="wiz-field-title"
        googleField="title"
        value={location.title ?? "-"}
        suggestion={byField.get("title")}
        categoryOptions={categoryOptions}
        editor={({ close }) => (
          <TitleEditor initial={location.title ?? ""} onDone={close} />
        )}
      />

      {primarySuggestion || additionalSuggestion ? (
        <div
          id="wiz-field-primary_category"
          className="wiz-field-row wiz-field-row-suggestion"
        >
          <span id="wiz-field-additional_categories" className="sr-only" />
          <CategoriesSuggestion
            primary={primary}
            additional={additional}
            primarySuggestion={primarySuggestion}
            additionalSuggestion={additionalSuggestion}
            categoryOptions={categoryOptions}
          />
        </div>
      ) : (
        <CategoriesFieldRow
          primary={primary}
          additional={additional}
          categoryOptions={categoryOptions}
          fingerprint={listFingerprint(location, "categories")}
        />
      )}

      <FieldRow
        label="Opis"
        anchorId="wiz-field-description"
        googleField="description"
        value={location.profile?.description ?? "Brak opisu"}
        multiline
        suggestion={byField.get("description")}
        categoryOptions={categoryOptions}
        editor={({ close }) => (
          <DescriptionEditor
            initial={location.profile?.description ?? ""}
            onDone={close}
          />
        )}
      />
      <FieldRow
        label="Status"
        googleField="openInfo"
        value={
          <span className="ui-pill ui-pill-success wiz-status-pill">
            <span className="wiz-status-dot" aria-hidden />
            {openStatusLabel(location.openInfo?.status)}
          </span>
        }
        editor={({ close }) => (
          <OpenStatusEditor
            status={location.openInfo?.status}
            openingDate={formatOpeningDate(location.openInfo?.openingDate)}
            onDone={close}
          />
        )}
      />
      <FieldRow
        label="Data otwarcia"
        value={
          <span className="mono">
            {displayOpeningDate(location.openInfo?.openingDate) || "-"}
          </span>
        }
        editor={({ close }) => (
          <OpeningDateEditor
            status={location.openInfo?.status}
            openingDate={formatOpeningDate(location.openInfo?.openingDate)}
            onDone={close}
          />
        )}
      />
      <LocationNapFields location={location} />
      <WebsiteFieldRow websiteUri={location.websiteUri} />
    </div>
  );
}

function WebsiteFieldRow({ websiteUri }: { websiteUri?: string }) {
  const [open, setOpen] = useState(false);
  useReportWizEditing(open);
  const raw = websiteUri?.trim() || "";
  const display = raw
    ? raw.replace(/^https?:\/\//, "").replace(/\/$/, "")
    : "-";

  return (
    <div id="wiz-field-website" className="wiz-field-row">
      <div className="wiz-field-label">Witryna</div>
      <div className="wiz-field-content">
        {raw.startsWith("http") ? (
          <a
            href={raw}
            target="_blank"
            rel="noreferrer"
            className="wiz-inline-link mono"
          >
            {display}
          </a>
        ) : (
          <span className="mono">{display}</span>
        )}
        {open ? null : <GoogleFieldNote field="website" />}
      </div>
      <button
        type="button"
        className={`wiz-field-edit${open ? " is-open" : ""}`}
        aria-label="Edytuj: Witryna"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? <X aria-hidden /> : <Pencil aria-hidden />}
      </button>
      {open ? (
        <div className="wiz-field-editor">
          <div className="wiz-edit-block">
            <WebsiteForm
              initial={websiteUri ?? ""}
              onDone={() => setOpen(false)}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function CategoriesFieldRow({
  primary,
  additional,
  categoryOptions,
  fingerprint,
}: {
  primary?: { name?: string | null; displayName?: string | null } | null;
  additional: Array<{ name?: string | null; displayName?: string | null }>;
  categoryOptions: Array<{ name: string; displayName: string }>;
  /** Fingerprint of Google's categories (taken again each time the editor opens). */
  fingerprint: string;
}) {
  const [open, setOpen] = useState(false);
  useReportWizEditing(open);
  const primaryLabel = primary?.displayName ?? primary?.name;
  const additionalNames = additional
    .map((c) => c.name)
    .filter((n): n is string => Boolean(n));

  return (
    <div id="wiz-field-primary_category" className="wiz-field-row">
      <span id="wiz-field-additional_categories" className="sr-only" />
      <div className="wiz-field-label">Kategorie</div>
      <div className="wiz-field-content">
        <ul className="wiz-cat-chips">
          {primaryLabel ? (
            <li>
              <span className="ui-pill wiz-cat-chip-primary">
                <Star aria-hidden className="wiz-cat-chip-star" />
                {primaryLabel}
              </span>
            </li>
          ) : null}
          {primaryLabel && additional.length > 0 ? (
            <li className="wiz-cat-chips-sep" aria-hidden />
          ) : null}
          {additional.map((c) => {
            const label = c.displayName ?? c.name;
            if (!label) return null;
            return (
              <li key={c.name ?? label}>
                <span className="ui-pill wiz-cat-chip-extra">{label}</span>
              </li>
            );
          })}
          {!primaryLabel && additional.length === 0 ? (
            <li>
              <span className="text-sm text-muted-foreground">Brak</span>
            </li>
          ) : null}
        </ul>
        {open ? null : <GoogleFieldNote field="categories" />}
      </div>
      <button
        type="button"
        className={`wiz-field-edit${open ? " is-open" : ""}`}
        aria-label="Edytuj: Kategorie"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? <X aria-hidden /> : <Pencil aria-hidden />}
      </button>
      {open ? (
        <div className="wiz-field-editor">
          <div className="wiz-edit-block">
            <CategoriesEditor
              mode="combined"
              primaryName={primary?.name ?? ""}
              additionalNames={additionalNames}
              options={categoryOptions}
              fingerprint={fingerprint}
              onDone={() => setOpen(false)}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function FieldRow({
  label,
  anchorId,
  value,
  multiline,
  editor,
  suggestion,
  suggestionCurrentFallback,
  categoryOptions,
  googleField,
}: {
  /** Field to show Google's change / pending review for. */
  googleField?: GoogleField;
  label: string;
  anchorId?: string;
  value: React.ReactNode;
  multiline?: boolean;
  editor: (args: { close: () => void }) => React.ReactNode;
  suggestion?: GbpSuggestion;
  suggestionCurrentFallback?: string;
  categoryOptions?: Array<{ name: string; displayName: string }>;
}) {
  const [open, setOpen] = useState(false);
  useReportWizEditing(open);

  if (suggestion) {
    return (
      <div id={anchorId} className="wiz-field-row wiz-field-row-suggestion">
        <InlineSuggestion
          suggestion={suggestion}
          currentDisplay={suggestionCurrentFallback ?? String(value ?? "")}
          categoryOptions={categoryOptions}
        />
        {googleField ? <GoogleFieldNote field={googleField} /> : null}
      </div>
    );
  }

  return (
    <div id={anchorId} className="wiz-field-row">
      <div className="wiz-field-label">{label}</div>
      <div className={`wiz-field-content ${multiline ? "multiline" : ""}`}>
        {open ? (
          <div className="wiz-edit-block">
            {editor({ close: () => setOpen(false) })}
          </div>
        ) : (
          value
        )}
        {googleField && !open ? <GoogleFieldNote field={googleField} /> : null}
      </div>
      <button
        type="button"
        className={`wiz-field-edit${open ? " is-open" : ""}`}
        aria-label={open ? `Zamknij: ${label}` : `Edytuj: ${label}`}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? <X aria-hidden /> : <Pencil aria-hidden />}
      </button>
    </div>
  );
}

function WebsiteForm({
  initial,
  onDone,
}: {
  initial: string;
  onDone: () => void;
}) {
  const router = useRouter();
  const [value, setValue] = useState(initial);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="wiz-edit-form"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const result = await updateGbpWebsite({ websiteUri: value });
          if (!result.ok) {
            toast.error({ title: "Nie zapisano", description: result.error });
            return;
          }
          toast.success({ title: "Witryna zapisana w Google" });
          onDone();
          router.refresh();
        });
      }}
    >
      <input
        className="ui-field"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="https://"
      />
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

function TitleEditor({
  initial,
  onDone,
}: {
  initial: string;
  onDone: () => void;
}) {
  const router = useRouter();
  const [value, setValue] = useState(initial);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="wiz-edit-form"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (!value.trim()) {
          toast.error({ title: "Podaj nazwę firmy" });
          return;
        }
        startTransition(async () => {
          const result = await updateGbpTitle({ title: value });
          if (!result.ok) {
            toast.error({ title: "Nie zapisano", description: result.error });
            return;
          }
          toast.success({ title: "Nazwa zapisana w Google" });
          onDone();
          router.refresh();
        });
      }}
    >
      <input
        className="ui-field"
        value={value}
        maxLength={100}
        onChange={(e) => setValue(e.target.value)}
      />
      <CharCount length={value.length} max={100} />
      <SaveButton pending={pending} />
    </form>
  );
}

/** Licznik znaków pod polem - koral od 95% limitu. */
function CharCount({ length, max }: { length: number; max: number }) {
  return (
    <span
      className="mono wiz-char-count"
      data-warn={length / max >= 0.95 ? "true" : undefined}
      aria-live="polite"
    >
      {length} / {max}
    </span>
  );
}

function DescriptionEditor({
  initial,
  onDone,
}: {
  initial: string;
  onDone: () => void;
}) {
  const router = useRouter();
  const [value, setValue] = useState(initial);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="wiz-edit-form"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (!value.trim()) {
          toast.error({ title: "Podaj opis" });
          return;
        }
        startTransition(async () => {
          const result = await updateGbpDescription({ description: value });
          if (!result.ok) {
            toast.error({ title: "Nie zapisano", description: result.error });
            return;
          }
          toast.success({ title: "Opis zapisany w Google" });
          onDone();
          router.refresh();
        });
      }}
    >
      <textarea
        className="ui-textarea"
        rows={5}
        maxLength={750}
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <CharCount length={value.length} max={750} />
      <SaveButton pending={pending} />
    </form>
  );
}

const OPEN_STATUS_OPTIONS = [
  { value: "OPEN", label: "Otwarte" },
  { value: "CLOSED_TEMPORARILY", label: "Tymczasowo zamknięte" },
  { value: "CLOSED_PERMANENTLY", label: "Trwale zamknięte" },
] as const;

function openStatusLabel(status?: string): string {
  return (
    OPEN_STATUS_OPTIONS.find((option) => option.value === status)?.label ?? "-"
  );
}

function displayOpeningDate(date?: {
  year?: number;
  month?: number;
  day?: number;
}): string {
  const iso = formatOpeningDate(date);
  if (!iso) return "";
  const [year, month, day] = iso.split("-");
  return `${day}.${month}.${year}`;
}

function parseOpeningDate(date: string) {
  const parts = date.split("-").map(Number);
  if (!parts[0]) return undefined;
  return {
    year: parts[0],
    month: parts[1] || undefined,
    day: parts[2] || undefined,
  };
}

function OpenStatusEditor({
  status,
  openingDate,
  onDone,
}: {
  status?: string;
  openingDate: string;
  onDone: () => void;
}) {
  const router = useRouter();
  const [st, setSt] = useState(status ?? "OPEN");
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="wiz-edit-form"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const result = await updateGbpOpenInfo({
            status: st,
            openingDate: parseOpeningDate(openingDate),
          });
          if (!result.ok) {
            toast.error({ title: "Nie zapisano", description: result.error });
            return;
          }
          toast.success({ title: "Status zapisany w Google" });
          onDone();
          router.refresh();
        });
      }}
    >
      <UiSelect
        aria-label="Status"
        value={st}
        onChange={setSt}
        options={[...OPEN_STATUS_OPTIONS]}
      />
      <SaveButton pending={pending} />
    </form>
  );
}

function OpeningDateEditor({
  status,
  openingDate,
  onDone,
}: {
  status?: string;
  openingDate: string;
  onDone: () => void;
}) {
  const router = useRouter();
  const [date, setDate] = useState(openingDate);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="wiz-edit-form"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (!date) {
          toast.error({ title: "Podaj datę otwarcia" });
          return;
        }
        startTransition(async () => {
          const result = await updateGbpOpenInfo({
            status: status ?? "OPEN",
            openingDate: parseOpeningDate(date),
          });
          if (!result.ok) {
            toast.error({ title: "Nie zapisano", description: result.error });
            return;
          }
          toast.success({ title: "Data otwarcia zapisana w Google" });
          onDone();
          router.refresh();
        });
      }}
    >
      <input
        className="ui-field"
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
      />
      <SaveButton pending={pending} />
    </form>
  );
}

function CategoriesEditor({
  mode,
  primaryName,
  additionalNames,
  options,
  fingerprint: openedFingerprint,
  onDone,
}: {
  mode: "primary" | "additional" | "combined";
  primaryName: string;
  additionalNames: string[];
  options: Array<{ name: string; displayName: string }>;
  /** Fingerprint of Google's categories when the editor opened. */
  fingerprint: string;
  onDone: () => void;
}) {
  const router = useRouter();
  const [fingerprint] = useState(openedFingerprint);
  const [primary, setPrimary] = useState(primaryName);
  const [additional, setAdditional] = useState(additionalNames.join("\n"));
  const [filter, setFilter] = useState("");
  const [pending, startTransition] = useTransition();

  const filtered = options
    .filter((o) =>
      o.displayName.toLowerCase().includes(filter.toLowerCase().trim()),
    )
    .slice(0, 40);

  const showPrimary = mode === "primary" || mode === "combined";
  const showAdditional = mode === "additional" || mode === "combined";

  return (
    <form
      className="wiz-edit-form"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const names = additional
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean);
        if (!primary) {
          toast.error({ title: "Wybierz kategorię główną" });
          return;
        }
        startTransition(async () => {
          const result = await updateGbpCategories({
            primaryCategoryName: primary,
            additionalCategoryNames: names.filter((n) => n !== primary),
            fingerprint,
          });
          if (!result.ok) {
            toast.error({ title: "Nie zapisano", description: result.error });
            if (result.conflict) {
              onDone();
              router.refresh();
            }
            return;
          }
          toast.success({ title: "Kategorie zapisane w Google" });
          onDone();
          router.refresh();
        });
      }}
    >
      {showPrimary ? (
        <>
          {mode === "combined" ? (
            <p className="text-sm font-medium">Kategoria główna</p>
          ) : null}
          <input
            className="ui-field"
            placeholder="Filtruj kategorie…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          <UiSelect
            aria-label="Kategoria główna"
            value={primary}
            onChange={setPrimary}
            options={filtered.map((o) => ({
              value: o.name,
              label: o.displayName,
            }))}
            placeholder="Wybierz kategorię"
          />
        </>
      ) : null}
      {showAdditional ? (
        <>
          {mode === "combined" ? (
            <p className="text-sm font-medium">Kategorie dodatkowe</p>
          ) : null}
          <p className="locked-note">
            Wklej identyfikatory kategorii (categories/gcid:…), po jednej w
            linii. Lista ze słownika Google.
          </p>
          <textarea
            className="ui-textarea"
            rows={4}
            value={additional}
            onChange={(e) => setAdditional(e.target.value)}
          />
          {mode !== "combined" ? (
            <input
              className="ui-field"
              placeholder="Szukaj nazwy, kliknij aby dodać…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          ) : null}
          <ul className="wiz-cat-suggest">
            {filtered.slice(0, 8).map((o) => (
              <li key={o.name}>
                <button
                  type="button"
                  className="ui-btn ui-btn-ghost ui-btn-sm"
                  onClick={() => {
                    setAdditional((prev) =>
                      prev.includes(o.name)
                        ? prev
                        : `${prev.trim()}\n${o.name}`.trim(),
                    );
                  }}
                >
                  {o.displayName}
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      <SaveButton pending={pending} />
    </form>
  );
}

function SaveButton({ pending }: { pending: boolean }) {
  return (
    <button
      type="submit"
      className="ui-btn ui-btn-primary ui-btn-sm"
      disabled={pending}
    >
      {pending ? <Loader2 aria-hidden className="ui-btn-spinner" /> : null}
      Zapisz w Google
    </button>
  );
}
