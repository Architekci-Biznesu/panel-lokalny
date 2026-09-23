"use client";

import { useRouter } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type FormEvent,
} from "react";
import { Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "gooey-toast";
import { updateGbpServices } from "@/features/wizytowka/actions";
import { InlineSuggestion } from "@/features/wizytowka/components/inline-suggestion";
import { serviceLabel } from "@/features/wizytowka/components/suggestion-display";
import {
  serviceItemsToDrafts,
  type GbpLocation,
  type ServiceItemDraft,
} from "@/features/wizytowka/types";
import type { GbpCategory } from "@/lib/integrations/gbp/client";
import type { GbpSuggestion } from "@/lib/db/schema";
import { UiSelect } from "@/features/shell/ui-select";

const NAME_MAX = 140;
const DESC_MAX = 250;

type Props = {
  location: GbpLocation;
  categoryDetails: GbpCategory[];
  suggestions?: GbpSuggestion[];
};

export function UslugiEditor({
  location,
  categoryDetails,
  suggestions = [],
}: Props) {
  const [open, setOpen] = useState(false);
  const [editCount, setEditCount] = useState(0);
  const canModifyServices = location.metadata?.canModifyServiceList !== false;
  const primary = location.categories?.primaryCategory;
  const serviceTypes = categoryDetails.flatMap((c) =>
    (c.serviceTypes ?? []).map((s) => ({
      ...s,
      categoryName: c.name,
    })),
  );
  const drafts = enrichServiceDrafts(
    serviceItemsToDrafts(location.serviceItems),
    serviceTypes,
  );
  const servicesSuggestion = suggestions.find((s) => s.field === "services");
  const servicesCurrentJson = JSON.stringify(location.serviceItems ?? []);
  const count = open ? editCount : drafts.length;

  return (
    <>
      <div className="wiz-tab-head">
        <div className="wiz-tab-head-text">
          <h2 className="text-lg font-semibold wiz-uslugi-title">
            Usługi
            {open ? (
              <span className="mono wiz-uslugi-count-badge">{count}</span>
            ) : null}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {open
              ? "Edycja - zmiany trafią do Google po zapisaniu"
              : "Pełna lista usług z wizytówki Google. Edytuj i zapisz - zmiany idą od razu do Google."}
          </p>
        </div>
        {canModifyServices && !servicesSuggestion ? (
          open ? (
            <button
              type="button"
              className="ui-btn ui-btn-ghost ui-btn-sm wiz-tab-head-edit"
              aria-label="Anuluj edycję usług"
              onClick={() => setOpen(false)}
            >
              <X aria-hidden />
            </button>
          ) : (
            <button
              type="button"
              className="ui-btn ui-btn-ghost ui-btn-sm wiz-tab-head-edit"
              aria-label="Edytuj usługi"
              onClick={() => {
                setEditCount(drafts.length);
                setOpen(true);
              }}
            >
              <Pencil aria-hidden />
            </button>
          )
        ) : null}
      </div>

      {servicesSuggestion ? (
        <div
          id="wiz-field-services"
          className="wiz-uslugi wiz-uslugi-suggestion"
        >
          <InlineSuggestion
            suggestion={servicesSuggestion}
            currentDisplay={servicesCurrentJson}
          />
        </div>
      ) : (
        <div
          id="wiz-field-services"
          className={`wiz-uslugi${open && canModifyServices ? " is-editing" : ""}`}
        >
          {!canModifyServices ? (
            <p className="locked-note wiz-tab-note">
              Edycja usług zablokowana przez Google dla tej wizytówki
              (canModifyServiceList).
            </p>
          ) : null}

          {open && canModifyServices ? (
            <ServicesEditor
              initial={drafts}
              primaryCategory={primary?.name ?? ""}
              serviceTypes={serviceTypes}
              onCountChange={setEditCount}
              onCancel={() => setOpen(false)}
              onDone={() => setOpen(false)}
            />
          ) : drafts.length ? (
            <ul className="wiz-uslugi-list">
              {drafts.map((item, index) => (
                <li
                  key={`${item.serviceTypeId ?? item.displayName}-${index}`}
                  className="wiz-uslugi-item"
                >
                  <div className="wiz-field-label">{serviceLabel(item)}</div>
                  {item.description ? (
                    <div className="wiz-field-content">{item.description}</div>
                  ) : (
                    <div className="wiz-field-content">-</div>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground wiz-tab-note">
              Brak usług na wizytówce. Dodaj je przez Edytuj albo zaakceptuj
              propozycję AI.
            </p>
          )}
        </div>
      )}
    </>
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

function sameServices(a: ServiceItemDraft[], b: ServiceItemDraft[]) {
  if (a.length !== b.length) return false;
  return a.every((item, index) => {
    const other = b[index];
    return (
      item.kind === other.kind &&
      item.displayName === other.displayName &&
      (item.description ?? "") === (other.description ?? "") &&
      (item.serviceTypeId ?? "") === (other.serviceTypeId ?? "") &&
      (item.category ?? "") === (other.category ?? "")
    );
  });
}

function ServicesEditor({
  initial,
  primaryCategory,
  serviceTypes,
  onCountChange,
  onCancel,
  onDone,
}: {
  initial: ServiceItemDraft[];
  primaryCategory: string;
  serviceTypes: Array<{
    serviceTypeId: string;
    displayName: string;
    categoryName: string;
  }>;
  onCountChange: (count: number) => void;
  onCancel: () => void;
  onDone: () => void;
}) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [hiddenBelow, setHiddenBelow] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLLIElement>(null);
  const scrollAfterAddRef = useRef(false);

  useEffect(() => {
    onCountChange(items.length);
  }, [items.length, onCountChange]);

  useEffect(() => {
    if (!scrollAfterAddRef.current) return;
    scrollAfterAddRef.current = false;
    const root = scrollRef.current;
    if (!root) return;
    requestAnimationFrame(() => {
      root.scrollTo({ top: root.scrollHeight, behavior: "smooth" });
      endRef.current?.querySelector<HTMLInputElement>("input")?.focus();
    });
  }, [items.length]);

  const dirty = !sameServices(items, initial);

  const usedTypeIds = new Set(
    items
      .map((item) => item.serviceTypeId)
      .filter((id): id is string => Boolean(id)),
  );
  const availableTypes = serviceTypes.filter(
    (s) => !usedTypeIds.has(s.serviceTypeId),
  );

  useEffect(() => {
    const root = scrollRef.current;
    const end = endRef.current;
    if (!root || !end || items.length === 0) {
      setHiddenBelow(0);
      return;
    }

    function measure() {
      const cards = root?.querySelectorAll(".wiz-service-card");
      if (!root || !cards?.length) {
        setHiddenBelow(0);
        return;
      }
      const rootBottom = root.getBoundingClientRect().bottom;
      let below = 0;
      cards.forEach((card) => {
        if (card.getBoundingClientRect().top >= rootBottom - 4) below += 1;
      });
      setHiddenBelow(below);
    }

    measure();
    root.addEventListener("scroll", measure, { passive: true });
    const ro = new ResizeObserver(measure);
    ro.observe(root);
    return () => {
      root.removeEventListener("scroll", measure);
      ro.disconnect();
    };
  }, [items.length]);

  function addFromDictionary(serviceTypeId: string) {
    const found = serviceTypes.find((s) => s.serviceTypeId === serviceTypeId);
    if (!found) return;
    scrollAfterAddRef.current = true;
    setItems((prev) => [
      ...prev,
      {
        kind: "structured",
        serviceTypeId: found.serviceTypeId,
        displayName: found.displayName,
        description: "",
      },
    ]);
  }

  function addCustom() {
    scrollAfterAddRef.current = true;
    setItems((prev) => [
      ...prev,
      {
        kind: "freeForm",
        category: primaryCategory,
        displayName: "",
        description: "",
      },
    ]);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!dirty) return;
    for (const item of items) {
      if (item.displayName.length > NAME_MAX) {
        toast.error({ title: `Nazwa usługi max ${NAME_MAX} znaków` });
        return;
      }
      if ((item.description ?? "").length > DESC_MAX) {
        toast.error({ title: `Opis usługi max ${DESC_MAX} znaków` });
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
  }

  return (
    <form
      className="wiz-edit-form wiz-services-form"
      noValidate
      onSubmit={onSubmit}
    >
      <div className="wiz-services-scroll" ref={scrollRef}>
        <ul className="wiz-services-edit">
          {items.map((item, index) => {
            const descLen = (item.description ?? "").length;
            const isLast = index === items.length - 1;
            return (
              <li
                key={`${item.serviceTypeId ?? item.displayName}-${index}`}
                className="wiz-service-card"
                ref={isLast ? endRef : undefined}
              >
                <div className="wiz-service-card-name-row">
                  <input
                    className="ui-field wiz-service-card-name"
                    value={item.displayName}
                    maxLength={NAME_MAX}
                    placeholder="Nazwa usługi"
                    onChange={(e) => {
                      const next = [...items];
                      next[index] = {
                        ...item,
                        displayName: e.target.value,
                        kind:
                          item.kind === "structured" ? "structured" : "freeForm",
                      };
                      setItems(next);
                    }}
                  />
                  <button
                    type="button"
                    className="ui-btn ui-btn-ghost ui-btn-sm wiz-service-card-remove"
                    aria-label={`Usuń usługę: ${item.displayName || "bez nazwy"}`}
                    onClick={() =>
                      setItems(items.filter((_, i) => i !== index))
                    }
                  >
                    <Trash2 aria-hidden />
                  </button>
                </div>
                <div className="wiz-service-card-desc">
                  <textarea
                    className="ui-textarea"
                    rows={3}
                    maxLength={DESC_MAX}
                    placeholder="Opis (opcjonalnie)"
                    value={item.description ?? ""}
                    onChange={(e) => {
                      const next = [...items];
                      next[index] = { ...item, description: e.target.value };
                      setItems(next);
                    }}
                  />
                  <span className="mono wiz-service-card-counter">
                    {descLen} / {DESC_MAX}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
        {hiddenBelow > 0 ? (
          <p className="wiz-services-more" aria-live="polite">
            + {hiddenBelow}{" "}
            {hiddenBelow === 1
              ? "kolejna usługa poniżej"
              : "kolejnych usług poniżej"}
          </p>
        ) : null}
      </div>

      <div className="wiz-services-sticky">
        <div className="wiz-services-sticky-add">
          <UiSelect
            aria-label="Dodaj usługę ze słownika"
            value=""
            placeholder="Dodaj ze słownika Google…"
            onChange={addFromDictionary}
            options={availableTypes.map((s) => ({
              value: s.serviceTypeId,
              label: s.displayName,
            }))}
            disabled={availableTypes.length === 0}
          />
          <button
            type="button"
            className="ui-btn ui-btn-outline ui-btn-sm"
            onClick={addCustom}
          >
            <Plus aria-hidden />
            Dodaj własną
          </button>
        </div>
        <div className="wiz-services-sticky-actions">
          <button
            type="button"
            className="ui-btn ui-btn-outline ui-btn-sm"
            disabled={pending}
            onClick={onCancel}
          >
            Anuluj
          </button>
          <button
            type="submit"
            className="ui-btn ui-btn-primary ui-btn-sm"
            disabled={pending || !dirty}
          >
            {pending ? <Loader2 aria-hidden className="ui-btn-spinner" /> : null}
            Zapisz w Google
          </button>
        </div>
      </div>
    </form>
  );
}
