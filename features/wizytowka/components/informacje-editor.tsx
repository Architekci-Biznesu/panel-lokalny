"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2, Pencil, WandSparkles, X } from "lucide-react";
import { toast } from "gooey-toast";
import {
  updateGbpCategories,
  updateGbpDescription,
  updateGbpOpenInfo,
  updateGbpServices,
  updateGbpTitle,
} from "@/features/wizytowka/actions";
import { InlineSuggestion } from "@/features/wizytowka/components/inline-suggestion";
import {
  formatOpeningDate,
  serviceItemsToDrafts,
  type GbpLocation,
  type ServiceItemDraft,
} from "@/features/wizytowka/types";
import type { GbpCategory } from "@/lib/integrations/gbp/client";
import type { GbpSuggestion } from "@/lib/db/schema";
import { UiSelect } from "@/features/shell/ui-select";

type Props = {
  location: GbpLocation;
  categoryDetails: GbpCategory[];
  categoryOptions: Array<{ name: string; displayName: string }>;
  suggestions?: GbpSuggestion[];
};

export function InformacjeEditor({
  location,
  categoryDetails,
  categoryOptions,
  suggestions = [],
}: Props) {
  const canModifyServices = location.metadata?.canModifyServiceList !== false;
  const primary = location.categories?.primaryCategory;
  const additional = location.categories?.additionalCategories ?? [];
  const serviceTypes = categoryDetails.flatMap((c) =>
    (c.serviceTypes ?? []).map((s) => ({
      ...s,
      categoryName: c.name,
    })),
  );

  const byField = new Map(suggestions.map((s) => [s.field, s]));

  const servicesCurrentJson = JSON.stringify(location.serviceItems ?? []);
  const additionalCurrentJson = JSON.stringify(
    additional.map((c) => c.name).filter(Boolean),
  );

  return (
    <div className="wiz-fields">
      <FieldRow
        label="Nazwa firmy"
        value={location.title ?? "-"}
        suggestion={byField.get("title")}
        categoryOptions={categoryOptions}
        editor={({ close }) => (
          <TitleEditor initial={location.title ?? ""} onDone={close} />
        )}
      />
      <FieldRow
        label="Kategoria główna"
        value={primary?.displayName ?? primary?.name ?? "-"}
        suggestion={byField.get("primary_category")}
        categoryOptions={categoryOptions}
        editor={({ close }) => (
          <CategoriesEditor
            mode="primary"
            primaryName={primary?.name ?? ""}
            additionalNames={additional
              .map((c) => c.name)
              .filter((n): n is string => Boolean(n))}
            options={categoryOptions}
            onDone={close}
          />
        )}
      />
      <FieldRow
        label="Kategorie dodatkowe"
        value={
          additional.length
            ? additional.map((c) => c.displayName ?? c.name).join(", ")
            : "Brak"
        }
        suggestion={byField.get("additional_categories")}
        suggestionCurrentFallback={additionalCurrentJson}
        categoryOptions={categoryOptions}
        editor={({ close }) => (
          <CategoriesEditor
            mode="additional"
            primaryName={primary?.name ?? ""}
            additionalNames={additional
              .map((c) => c.name)
              .filter((n): n is string => Boolean(n))}
            options={categoryOptions}
            onDone={close}
          />
        )}
      />
      <FieldRow
        label="Opis"
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
        label="Data otwarcia"
        value={
          formatOpeningDate(location.openInfo?.openingDate) ||
          location.openInfo?.status ||
          "-"
        }
        editor={({ close }) => (
          <OpenInfoEditor
            status={location.openInfo?.status}
            openingDate={formatOpeningDate(location.openInfo?.openingDate)}
            onDone={close}
          />
        )}
      />
      <FieldRow
        label="Usługi"
        value={
          (location.serviceItems ?? []).length
            ? `${location.serviceItems!.length} pozycji`
            : "Brak usług"
        }
        suggestion={byField.get("services")}
        suggestionCurrentFallback={servicesCurrentJson}
        categoryOptions={categoryOptions}
        editor={({ close }) =>
          canModifyServices ? (
            <ServicesEditor
              initial={enrichServiceDrafts(
                serviceItemsToDrafts(location.serviceItems),
                serviceTypes,
              )}
              primaryCategory={primary?.name ?? ""}
              serviceTypes={serviceTypes}
              onDone={close}
            />
          ) : (
            <p className="locked-note">
              Google nie pozwala edytować listy usług dla tej lokalizacji
              (canModifyServiceList).
            </p>
          )
        }
      />
      {!canModifyServices ? (
        <p className="locked-note">
          Edycja usług zablokowana przez Google dla tej wizytówki.
        </p>
      ) : null}
    </div>
  );
}

function enrichServiceDrafts(
  drafts: ServiceItemDraft[],
  serviceTypes: Array<{ serviceTypeId: string; displayName: string }>,
): ServiceItemDraft[] {
  const map = new Map(serviceTypes.map((s) => [s.serviceTypeId, s.displayName]));
  return drafts.map((d) =>
    d.kind === "structured" && d.serviceTypeId
      ? { ...d, displayName: map.get(d.serviceTypeId) ?? d.displayName }
      : d,
  );
}

function FieldRow({
  label,
  value,
  multiline,
  editor,
  suggestion,
  suggestionCurrentFallback,
  categoryOptions,
}: {
  label: string;
  value: string;
  multiline?: boolean;
  editor: (args: { close: () => void }) => React.ReactNode;
  suggestion?: GbpSuggestion;
  suggestionCurrentFallback?: string;
  categoryOptions?: Array<{ name: string; displayName: string }>;
}) {
  const [open, setOpen] = useState(false);

  if (suggestion) {
    return (
      <div className="wiz-field-row wiz-field-row-suggestion">
        <div className="wiz-field-main">
          <div className="wiz-field-label">
            <WandSparkles aria-hidden className="wiz-field-ai-icon" />
            {label}
          </div>
          <InlineSuggestion
            suggestion={suggestion}
            currentDisplay={suggestionCurrentFallback ?? value}
            categoryOptions={categoryOptions}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="wiz-field-row">
      <div className="wiz-field-main">
        <div className="wiz-field-label">{label}</div>
        <div className={`wiz-field-value ${multiline ? "multiline" : ""}`}>
          {value}
        </div>
      </div>
      <button
        type="button"
        className="ui-btn ui-btn-ghost ui-btn-sm"
        aria-label={`Edytuj: ${label}`}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? <X aria-hidden /> : <Pencil aria-hidden />}
      </button>
      {open ? (
        <div className="wiz-field-editor">
          {editor({ close: () => setOpen(false) })}
        </div>
      ) : null}
    </div>
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
      <SaveButton pending={pending} />
    </form>
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
      <SaveButton pending={pending} />
    </form>
  );
}

function OpenInfoEditor({
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
  const [date, setDate] = useState(openingDate);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="wiz-edit-form"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const parts = date.split("-").map(Number);
          const payload: {
            status: "OPEN" | "CLOSED_TEMPORARILY" | "CLOSED_PERMANENTLY";
            openingDate?: { year: number; month?: number; day?: number };
          } = {
            status: st as "OPEN" | "CLOSED_TEMPORARILY" | "CLOSED_PERMANENTLY",
          };
          if (parts[0]) {
            payload.openingDate = {
              year: parts[0],
              month: parts[1] || undefined,
              day: parts[2] || undefined,
            };
          }
          const result = await updateGbpOpenInfo(payload);
          if (!result.ok) {
            toast.error({ title: "Nie zapisano", description: result.error });
            return;
          }
          toast.success({ title: "Zapisano w Google" });
          onDone();
          router.refresh();
        });
      }}
    >
      <UiSelect
        aria-label="Status"
        value={st}
        onChange={setSt}
        options={[
          { value: "OPEN", label: "Otwarte" },
          { value: "CLOSED_TEMPORARILY", label: "Tymczasowo zamknięte" },
          { value: "CLOSED_PERMANENTLY", label: "Trwale zamknięte" },
        ]}
      />
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
  onDone,
}: {
  mode: "primary" | "additional";
  primaryName: string;
  additionalNames: string[];
  options: Array<{ name: string; displayName: string }>;
  onDone: () => void;
}) {
  const router = useRouter();
  const [primary, setPrimary] = useState(primaryName);
  const [additional, setAdditional] = useState(additionalNames.join("\n"));
  const [filter, setFilter] = useState("");
  const [pending, startTransition] = useTransition();

  const filtered = options
    .filter((o) =>
      o.displayName.toLowerCase().includes(filter.toLowerCase().trim()),
    )
    .slice(0, 40);

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
          });
          if (!result.ok) {
            toast.error({ title: "Nie zapisano", description: result.error });
            return;
          }
          toast.success({ title: "Kategorie zapisane w Google" });
          onDone();
          router.refresh();
        });
      }}
    >
      {mode === "primary" ? (
        <>
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
      ) : (
        <>
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
          <input
            className="ui-field"
            placeholder="Szukaj nazwy, kliknij aby dodać…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
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
      )}
      <SaveButton pending={pending} />
    </form>
  );
}

function ServicesEditor({
  initial,
  primaryCategory,
  serviceTypes,
  onDone,
}: {
  initial: ServiceItemDraft[];
  primaryCategory: string;
  serviceTypes: Array<{
    serviceTypeId: string;
    displayName: string;
    categoryName: string;
  }>;
  onDone: () => void;
}) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="wiz-edit-form"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        for (const item of items) {
          if (item.displayName.length > 140) {
            toast.error({ title: "Nazwa usługi max 140 znaków" });
            return;
          }
          if ((item.description ?? "").length > 250) {
            toast.error({ title: "Opis usługi max 250 znaków" });
            return;
          }
        }
        startTransition(async () => {
          const result = await updateGbpServices({ services: items });
          if (!result.ok) {
            toast.error({ title: "Nie zapisano", description: result.error });
            return;
          }
          toast.success({ title: "Usługi zapisane w Google" });
          onDone();
          router.refresh();
        });
      }}
    >
      <ul className="wiz-services-edit">
        {items.map((item, index) => (
          <li key={`${item.serviceTypeId ?? item.displayName}-${index}`}>
            <input
              className="ui-field"
              value={item.displayName}
              maxLength={140}
              placeholder="Nazwa usługi"
              onChange={(e) => {
                const next = [...items];
                next[index] = {
                  ...item,
                  displayName: e.target.value,
                  kind: item.kind === "structured" ? "structured" : "freeForm",
                };
                setItems(next);
              }}
            />
            <textarea
              className="ui-textarea"
              rows={2}
              maxLength={250}
              placeholder="Opis (opcjonalnie)"
              value={item.description ?? ""}
              onChange={(e) => {
                const next = [...items];
                next[index] = { ...item, description: e.target.value };
                setItems(next);
              }}
            />
            <button
              type="button"
              className="ui-btn ui-btn-ghost ui-btn-sm"
              onClick={() => setItems(items.filter((_, i) => i !== index))}
            >
              Usuń
            </button>
          </li>
        ))}
      </ul>
      <div className="wiz-services-add">
        <UiSelect
          aria-label="Dodaj usługę ze słownika"
          value=""
          placeholder="Dodaj ze słownika Google…"
          onChange={(serviceTypeId) => {
            const found = serviceTypes.find(
              (s) => s.serviceTypeId === serviceTypeId,
            );
            if (!found) return;
            setItems([
              ...items,
              {
                kind: "structured",
                serviceTypeId: found.serviceTypeId,
                displayName: found.displayName,
                description: "",
              },
            ]);
          }}
          options={serviceTypes.map((s) => ({
            value: s.serviceTypeId,
            label: s.displayName,
          }))}
        />
        <button
          type="button"
          className="ui-btn ui-btn-outline ui-btn-sm"
          onClick={() =>
            setItems([
              ...items,
              {
                kind: "freeForm",
                category: primaryCategory,
                displayName: "",
                description: "",
              },
            ])
          }
        >
          Dodaj własną
        </button>
      </div>
      <SaveButton pending={pending} />
    </form>
  );
}

function SaveButton({ pending }: { pending: boolean }) {
  return (
    <button type="submit" className="ui-btn ui-btn-primary ui-btn-sm" disabled={pending}>
      {pending ? <Loader2 aria-hidden className="ui-btn-spinner" /> : null}
      Zapisz w Google
    </button>
  );
}
