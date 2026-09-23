"use client";

import type { GbpSuggestion } from "@/lib/db/schema";

export type ServiceDraft = {
  kind?: string;
  serviceTypeId?: string;
  displayName?: string;
  description?: string;
  category?: string;
};

export function parseJsonArray(value: string): unknown[] | null {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function categoryLabel(name: string): string {
  return name
    .replace(/^categories\//, "")
    .replace(/^gcid:/, "")
    .replace(/_/g, " ");
}

export function serviceLabel(item: ServiceDraft): string {
  if (item.displayName?.trim()) return item.displayName.trim();
  if (item.serviceTypeId) return categoryLabel(item.serviceTypeId);
  return "Usługa";
}

/** Normalize either ServiceDraft JSON or raw GBP serviceItems JSON. */
export function normalizeServicesForPreview(value: string): ServiceDraft[] {
  const items = parseJsonArray(value);
  if (!items) return [];

  return items.map((raw) => {
    const item = raw as Record<string, unknown>;
    if (item.structuredServiceItem || item.freeFormServiceItem) {
      const structured = item.structuredServiceItem as
        | { serviceTypeId?: string; description?: string }
        | undefined;
      const free = item.freeFormServiceItem as
        | {
            category?: string;
            label?: { displayName?: string; description?: string };
          }
        | undefined;
      if (structured?.serviceTypeId) {
        return {
          kind: "structured" as const,
          serviceTypeId: structured.serviceTypeId,
          displayName: structured.serviceTypeId,
          description: structured.description ?? "",
        };
      }
      return {
        kind: "freeForm" as const,
        category: free?.category,
        displayName: free?.label?.displayName ?? "",
        description: free?.label?.description ?? "",
      };
    }
    return item as ServiceDraft;
  });
}

export function resolveCategoryDisplay(
  name: string,
  categoryOptions?: Array<{ name: string; displayName: string }>,
): string {
  const found = categoryOptions?.find((c) => c.name === name);
  return found?.displayName ?? categoryLabel(name);
}

export function SuggestionValuePreview({
  field,
  value,
  categoryOptions,
  struck,
}: {
  field: string;
  value: string;
  categoryOptions?: Array<{ name: string; displayName: string }>;
  struck?: boolean;
}) {
  const wrapClass = struck ? "wiz-inline-old" : "wiz-inline-new";

  if (field === "services") {
    const items = normalizeServicesForPreview(value);
    if (items.length) {
      return (
        <ul className={`wiz-preview-list ${wrapClass}`}>
          {items.map((item, index) => (
            <li
              key={`${serviceLabel(item)}-${index}`}
              className="wiz-preview-item"
            >
              <p className="wiz-preview-title">{serviceLabel(item)}</p>
              {item.description ? (
                <p className="wiz-preview-desc">{item.description}</p>
              ) : null}
            </li>
          ))}
        </ul>
      );
    }
    return <p className={wrapClass}>{struck ? "Brak usług" : "Brak"}</p>;
  }

  if (field === "additional_categories") {
    const items = parseJsonArray(value);
    if (items?.length) {
      return (
        <ul className={`wiz-preview-chips ${wrapClass}`}>
          {items.map((item, index) => {
            const raw =
              typeof item === "string"
                ? item
                : typeof item === "object" &&
                    item &&
                    "name" in item &&
                    typeof (item as { name?: string }).name === "string"
                  ? (item as { name: string }).name
                  : String(item);
            const label = resolveCategoryDisplay(raw, categoryOptions);
            return (
              <li key={`${label}-${index}`}>
                <span className="ui-pill ui-pill-neutral">{label}</span>
              </li>
            );
          })}
        </ul>
      );
    }
    return <p className={wrapClass}>Brak</p>;
  }

  if (field === "primary_category") {
    return (
      <p className={wrapClass}>
        {resolveCategoryDisplay(value, categoryOptions)}
      </p>
    );
  }

  return <p className={`${wrapClass} wiz-preview-plain`}>{value || "-"}</p>;
}

export function SuggestionValueEditor({
  field,
  value,
  onChange,
}: {
  field: string;
  value: string;
  onChange: (next: string) => void;
}) {
  if (field === "services") {
    const items = (parseJsonArray(value) as ServiceDraft[] | null) ?? [];
    return (
      <ul className="wiz-preview-edit">
        {items.map((item, index) => (
          <li key={index}>
            <input
              className="ui-field"
              value={item.displayName ?? serviceLabel(item)}
              maxLength={140}
              placeholder="Nazwa usługi"
              onChange={(e) => {
                const next = [...items];
                next[index] = {
                  ...item,
                  displayName: e.target.value,
                  kind: item.kind === "structured" ? "structured" : "freeForm",
                };
                onChange(JSON.stringify(next));
              }}
            />
            <textarea
              className="ui-textarea"
              rows={2}
              maxLength={250}
              placeholder="Opis"
              value={item.description ?? ""}
              onChange={(e) => {
                const next = [...items];
                next[index] = { ...item, description: e.target.value };
                onChange(JSON.stringify(next));
              }}
            />
          </li>
        ))}
      </ul>
    );
  }

  if (field === "additional_categories") {
    const items = (parseJsonArray(value) as string[] | null) ?? [];
    return (
      <textarea
        className="ui-textarea wiz-suggestion-edit"
        rows={4}
        value={items.join("\n")}
        onChange={(e) => {
          const names = e.target.value
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean);
          onChange(JSON.stringify(names));
        }}
        placeholder={"categories/gcid:...\npo jednej w linii"}
      />
    );
  }

  return (
    <textarea
      className="ui-textarea wiz-suggestion-edit"
      value={value}
      rows={field === "description" ? 6 : 3}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export function aiHintForSuggestion(suggestion: GbpSuggestion): string {
  if (suggestion.risk === "high" || suggestion.field === "title") {
    return "AI proponuje zmianę · pod SEO";
  }
  if (suggestion.field === "primary_category") {
    return "AI proponuje zmianę · kategoria główna";
  }
  if (suggestion.field === "additional_categories") {
    return "AI proponuje zmianę · kategorie";
  }
  if (suggestion.field === "services") {
    return "AI proponuje zmianę · usługi";
  }
  if (suggestion.field === "description") {
    return "AI proponuje zmianę · opis";
  }
  return "AI proponuje zmianę";
}

export function currentValueForDisplay(
  field: string,
  suggestion: GbpSuggestion,
  fallback: string,
): string {
  if (suggestion.currentValue != null && suggestion.currentValue !== "") {
    return suggestion.currentValue;
  }
  return fallback;
}
