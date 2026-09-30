import type { GbpLocation } from "@/features/wizytowka/types";

/**
 * Fields the panel saves to Google as a whole (the update mask names the whole
 * field, so the sent value replaces what Google has). Editing them on data a
 * few minutes old could silently drop something added in Google meanwhile -
 * the editor takes a fingerprint when it opens and the save compares it with
 * a fresh read. Pure - used by editors in the browser and by actions.
 */
export type WholeListField =
  | "serviceItems"
  | "categories"
  | "regularHours"
  | "specialHours"
  | "phoneNumbers"
  | "serviceArea";

export const WHOLE_LIST_CONFLICT_MESSAGES: Record<WholeListField, string> = {
  serviceItems:
    "Usługi zmieniły się w Google od czasu otwarcia edycji - odświeżyliśmy listę, sprawdź i zapisz ponownie",
  categories:
    "Kategorie zmieniły się w Google od czasu otwarcia edycji - odświeżyliśmy listę, sprawdź i zapisz ponownie",
  regularHours:
    "Godziny otwarcia zmieniły się w Google od czasu otwarcia edycji - odświeżyliśmy je, sprawdź i zapisz ponownie",
  specialHours:
    "Godziny specjalne zmieniły się w Google od czasu otwarcia edycji - odświeżyliśmy listę, sprawdź i zapisz ponownie",
  phoneNumbers:
    "Numery telefonów zmieniły się w Google od czasu otwarcia edycji - odświeżyliśmy je, sprawdź i zapisz ponownie",
  serviceArea:
    "Obszar obsługi zmienił się w Google od czasu otwarcia edycji - odświeżyliśmy go, sprawdź i zapisz ponownie",
};

/**
 * JSON with sorted keys and without empty values (null, "", [], {}), so key
 * order and missing-vs-empty do not matter. Empty everywhere gives "null".
 */
function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return value.length === 0 ? "null" : `[${value.map(stableJson).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .map(([k, v]) => [k, stableJson(v)] as const)
      .filter(([, json]) => json !== "null")
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    if (entries.length === 0) return "null";
    return `{${entries.map(([k, json]) => `${JSON.stringify(k)}:${json}`).join(",")}}`;
  }
  if (value === undefined || value === null || value === "") return "null";
  return JSON.stringify(value);
}

/** 64-bit FNV-1a as hex - short, deterministic, the same in Node and the browser. */
function fnv1a64(text: string): string {
  let hash = BigInt("0xcbf29ce484222325");
  const prime = BigInt("0x100000001b3");
  const mask = BigInt("0xffffffffffffffff");
  for (let i = 0; i < text.length; i++) {
    hash ^= BigInt(text.charCodeAt(i));
    hash = (hash * prime) & mask;
  }
  return hash.toString(16).padStart(16, "0");
}

export function listFingerprint(
  location: GbpLocation,
  field: WholeListField,
): string {
  return fnv1a64(stableJson(location[field] ?? null));
}
