import type { GbpAttributeMetadata } from "@/lib/integrations/gbp/client";

export type GbpAttrValueType =
  "BOOL" | "ENUM" | "REPEATED_ENUM" | "URL" | string;

export type ParsedAttributeValue =
  | { valueType: "BOOL"; bool: boolean | null }
  | { valueType: "ENUM"; enumValue: string | null }
  | {
      valueType: "REPEATED_ENUM";
      setValues: string[];
      unsetValues: string[];
    }
  | { valueType: "URL"; uri: string | null };

/** Short id used in attributeMask (`has_live_music`). */
export function attributeId(name: string): string {
  return name.replace(/^attributes\//, "");
}

/** Resource / API name form (`attributes/has_live_music`). */
export function attributeResourceName(name: string): string {
  const id = attributeId(name);
  return id.startsWith("attributes/") ? id : `attributes/${id}`;
}

export function isUrlAttr(meta: GbpAttributeMetadata): boolean {
  return (meta.valueType ?? "").toUpperCase() === "URL";
}

export function isFactAttr(meta: GbpAttributeMetadata): boolean {
  if (meta.deprecated) return false;
  const t = (meta.valueType ?? "BOOL").toUpperCase();
  return t === "BOOL" || t === "ENUM" || t === "REPEATED_ENUM";
}

export function activeMetadata(
  metadata: GbpAttributeMetadata[],
): GbpAttributeMetadata[] {
  return metadata.filter((m) => !m.deprecated && m.parent);
}

export function factMetadata(
  metadata: GbpAttributeMetadata[],
): GbpAttributeMetadata[] {
  return activeMetadata(metadata).filter(isFactAttr);
}

export function urlMetadata(
  metadata: GbpAttributeMetadata[],
): GbpAttributeMetadata[] {
  return activeMetadata(metadata).filter(isUrlAttr);
}

export function parseAttributeValues(
  attributes: Array<Record<string, unknown>>,
  metadata: GbpAttributeMetadata[] = [],
): Map<string, ParsedAttributeValue> {
  const metaById = new Map(
    metadata.map((m) => [attributeId(m.parent), m] as const),
  );
  const map = new Map<string, ParsedAttributeValue>();

  for (const attr of attributes) {
    const name = typeof attr.name === "string" ? attr.name : null;
    if (!name) continue;
    const id = attributeId(name);
    const meta = metaById.get(id);

    let valueType = String(
      attr.valueType ?? meta?.valueType ?? "",
    ).toUpperCase();
    if (!valueType) {
      if (attr.repeatedEnumValue) valueType = "REPEATED_ENUM";
      else if (attr.uriValues) valueType = "URL";
      else if (Array.isArray(attr.values)) valueType = "BOOL";
      else continue;
    }

    if (valueType === "BOOL") {
      const values = Array.isArray(attr.values) ? attr.values : [];
      const first = values[0];
      const bool =
        typeof first === "boolean"
          ? first
          : first === "true"
            ? true
            : first === "false"
              ? false
              : null;
      map.set(id, { valueType: "BOOL", bool });
      continue;
    }

    if (valueType === "ENUM") {
      const values = Array.isArray(attr.values) ? attr.values : [];
      const first = values[0];
      map.set(id, {
        valueType: "ENUM",
        enumValue: first == null ? null : String(first),
      });
      continue;
    }

    if (valueType === "REPEATED_ENUM") {
      const repeated = (attr.repeatedEnumValue ?? {}) as {
        setValues?: unknown;
        unsetValues?: unknown;
      };
      map.set(id, {
        valueType: "REPEATED_ENUM",
        setValues: Array.isArray(repeated.setValues)
          ? repeated.setValues.map(String)
          : [],
        unsetValues: Array.isArray(repeated.unsetValues)
          ? repeated.unsetValues.map(String)
          : [],
      });
      continue;
    }

    if (valueType === "URL") {
      const uriValues = Array.isArray(attr.uriValues) ? attr.uriValues : [];
      const first = uriValues[0] as { uri?: unknown } | undefined;
      const uri =
        first && typeof first.uri === "string" && first.uri.trim()
          ? first.uri.trim()
          : null;
      map.set(id, { valueType: "URL", uri });
    }
  }

  return map;
}

export function groupFactsByGroup(
  metadata: GbpAttributeMetadata[],
): Array<{ group: string; items: GbpAttributeMetadata[] }> {
  const order: string[] = [];
  const buckets = new Map<string, GbpAttributeMetadata[]>();

  for (const meta of factMetadata(metadata)) {
    const group = meta.groupDisplayName?.trim() || "Inne";
    if (!buckets.has(group)) {
      buckets.set(group, []);
      order.push(group);
    }
    buckets.get(group)!.push(meta);
  }

  return order.map((group) => ({
    group,
    items: buckets.get(group)!,
  }));
}

export function buildAttributeUpdateBody(input: {
  attributeName: string;
  valueType: string;
  clear?: boolean;
  boolValue?: boolean;
  enumValue?: string;
  repeatedEnum?: { setValues?: string[]; unsetValues?: string[] };
  uri?: string;
}): {
  attributes: Array<Record<string, unknown>>;
  attributeMask: string[];
} {
  const id = attributeId(input.attributeName);
  const name = attributeResourceName(id);
  // v1 API: attributeMask must be `attributes/{id}`, not the bare id
  const mask = [name];
  const valueType = input.valueType.toUpperCase();

  if (input.clear) {
    return { attributes: [], attributeMask: mask };
  }

  const base: Record<string, unknown> = { name, valueType };

  if (valueType === "BOOL") {
    if (typeof input.boolValue !== "boolean") {
      throw new Error("Brak wartości BOOL");
    }
    return {
      attributes: [{ ...base, values: [input.boolValue] }],
      attributeMask: mask,
    };
  }

  if (valueType === "ENUM") {
    if (!input.enumValue) {
      throw new Error("Brak wartości ENUM");
    }
    return {
      attributes: [{ ...base, values: [input.enumValue] }],
      attributeMask: mask,
    };
  }

  if (valueType === "REPEATED_ENUM") {
    const setValues = input.repeatedEnum?.setValues ?? [];
    const unsetValues = input.repeatedEnum?.unsetValues ?? [];
    if (!setValues.length && !unsetValues.length) {
      throw new Error("Brak wartości REPEATED_ENUM");
    }
    return {
      attributes: [
        {
          ...base,
          repeatedEnumValue: {
            ...(setValues.length ? { setValues } : {}),
            ...(unsetValues.length ? { unsetValues } : {}),
          },
        },
      ],
      attributeMask: mask,
    };
  }

  if (valueType === "URL") {
    if (!input.uri?.trim()) {
      throw new Error("Brak URI");
    }
    return {
      attributes: [{ ...base, uriValues: [{ uri: input.uri.trim() }] }],
      attributeMask: mask,
    };
  }

  throw new Error(`Nieobsługiwany typ atrybutu: ${valueType}`);
}
