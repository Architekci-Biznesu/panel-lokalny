"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2, Pencil, X } from "lucide-react";
import { toast } from "gooey-toast";
import {
  updateGbpAttribute,
} from "@/features/wizytowka/actions";
import {
  attributeId,
  parseAttributeValues,
  urlMetadata,
} from "@/features/wizytowka/attributes";
import type { GbpLocation } from "@/features/wizytowka/types";
import type { GbpAttributeMetadata } from "@/lib/integrations/gbp/client";

export function KontaktEditor({
  location: _location,
  attributes = [],
  attributeMetadata = [],
}: {
  location: GbpLocation;
  attributes?: Array<Record<string, unknown>>;
  attributeMetadata?: GbpAttributeMetadata[];
}) {
  const values = parseAttributeValues(attributes, attributeMetadata);
  const urlAttrs = urlMetadata(attributeMetadata);

  return (
    <div className="wiz-fields">
      {urlAttrs.map((meta) => {
        const id = attributeId(meta.parent);
        const current = values.get(id);
        const uri = current?.valueType === "URL" ? current.uri : null;
        const label = meta.displayName ?? id;
        return (
          <Editable
            key={meta.parent}
            label={label}
            display={uri || "-"}
            editor={({ close }) => (
              <UrlAttrForm meta={meta} initial={uri ?? ""} onDone={close} />
            )}
          />
        );
      })}
    </div>
  );
}

function Editable({
  label,
  display,
  editor,
}: {
  label: string;
  display: string;
  editor: (args: { close: () => void }) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="wiz-field-row">
      <div className="wiz-field-label">{label}</div>
      <div className="wiz-field-content">
        {display.startsWith("http") ? (
          <a
            href={display}
            target="_blank"
            rel="noreferrer"
            className="wiz-inline-link"
          >
            {display}
          </a>
        ) : (
          display
        )}
      </div>
      <button
        type="button"
        className="ui-btn ui-btn-ghost ui-btn-sm wiz-field-edit"
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

function UrlAttrForm({
  meta,
  initial,
  onDone,
}: {
  meta: GbpAttributeMetadata;
  initial: string;
  onDone: () => void;
}) {
  const router = useRouter();
  const [value, setValue] = useState(initial);
  const [pending, startTransition] = useTransition();
  const label = meta.displayName ?? attributeId(meta.parent);

  return (
    <form
      className="wiz-edit-form"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const trimmed = value.trim();
        if (trimmed && !/^https?:\/\//i.test(trimmed)) {
          toast.error({
            title: "Podaj pełny link",
            description: "Link powinien zaczynać się od https://",
          });
          return;
        }
        startTransition(async () => {
          const result = trimmed
            ? await updateGbpAttribute({
                attributeName: meta.parent,
                valueType: "URL",
                uri: trimmed,
              })
            : await updateGbpAttribute({
                attributeName: meta.parent,
                valueType: "URL",
                clear: true,
              });
          if (!result.ok) {
            toast.error({ title: "Nie zapisano", description: result.error });
            return;
          }
          toast.success({ title: `${label} zapisane w Google` });
          onDone();
          router.refresh();
        });
      }}
    >
      <input
        className="ui-field"
        type="url"
        inputMode="url"
        placeholder="https://"
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <div className="wiz-edit-actions">
        <button
          type="submit"
          className="ui-btn ui-btn-primary"
          disabled={pending}
        >
          {pending ? <Loader2 aria-hidden className="ui-btn-spinner" /> : null}
          Zapisz w Google
        </button>
        {initial ? (
          <button
            type="button"
            className="ui-btn ui-btn-ghost ui-btn-sm"
            disabled={pending}
            onClick={() => {
              setValue("");
              startTransition(async () => {
                const result = await updateGbpAttribute({
                  attributeName: meta.parent,
                  valueType: "URL",
                  clear: true,
                });
                if (!result.ok) {
                  toast.error({
                    title: "Nie usunięto",
                    description: result.error,
                  });
                  return;
                }
                toast.success({ title: `${label} usunięte z Google` });
                onDone();
                router.refresh();
              });
            }}
          >
            Wyczyść
          </button>
        ) : null}
      </div>
    </form>
  );
}
