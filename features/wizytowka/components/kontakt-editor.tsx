"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2, Pencil, SquareArrowOutUpRight, X } from "lucide-react";
import { toast } from "gooey-toast";
import { updateGbpAttribute } from "@/features/wizytowka/actions";
import {
  attributeId,
  parseAttributeValues,
  urlMetadata,
} from "@/features/wizytowka/attributes";
import type { GbpLocation } from "@/features/wizytowka/types";
import type { GbpAttributeMetadata } from "@/lib/integrations/gbp/client";

function displayUrl(url: string) {
  return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

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
            uri={uri}
            editor={({ close }) => (
              <UrlAttrForm meta={meta} initial={uri ?? ""} onDone={close} />
            )}
          />
        );
      })}
      <p className="wiz-kontakt-foot">
        Pola to atrybuty URL z Google - lista zależy od kategorii wizytówki.
        Puste pole i „Zapisz w Google” usuwa link.
      </p>
    </div>
  );
}

function Editable({
  label,
  uri,
  editor,
}: {
  label: string;
  uri: string | null;
  editor: (args: { close: () => void }) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="wiz-field-row">
      <div className="wiz-field-label">{label}</div>
      <div className="wiz-field-content">
        {open ? (
          <div className="wiz-edit-block">
            {editor({ close: () => setOpen(false) })}
          </div>
        ) : uri ? (
          <a
            href={uri}
            target="_blank"
            rel="noreferrer"
            className="wiz-inline-link mono"
          >
            {displayUrl(uri)}
            <SquareArrowOutUpRight
              aria-hidden
              className="wiz-ext-link-icon"
            />
          </a>
        ) : (
          <span className="mono text-muted-foreground">-</span>
        )}
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
        className="ui-field mono"
        type="url"
        inputMode="url"
        placeholder="https://"
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <div className="wiz-edit-actions">
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
        <button
          type="submit"
          className="ui-btn ui-btn-primary ui-btn-sm"
          disabled={pending}
        >
          {pending ? <Loader2 aria-hidden className="ui-btn-spinner" /> : null}
          Zapisz w Google
        </button>
      </div>
    </form>
  );
}
