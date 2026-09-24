"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  Check,
  Loader2,
  Pencil,
  Star,
  WandSparkles,
  X,
} from "lucide-react";
import { toast } from "gooey-toast";
import {
  acceptGbpSuggestion,
  rejectGbpSuggestion,
} from "@/features/wizytowka/actions";
import { CategorySearchPicker } from "@/features/wizytowka/components/category-search-picker";
import {
  parseJsonArray,
  resolveCategoryDisplay,
} from "@/features/wizytowka/components/suggestion-display";
import type { GbpSuggestion } from "@/lib/db/schema";

type Cat = { name?: string | null; displayName?: string | null };

type Props = {
  primary: Cat | null | undefined;
  additional: Cat[];
  primarySuggestion?: GbpSuggestion;
  additionalSuggestion?: GbpSuggestion;
  categoryOptions: Array<{ name: string; displayName: string }>;
};

function chipLabel(
  name: string,
  options: Array<{ name: string; displayName: string }>,
  fallbackDisplay?: string | null,
) {
  return (
    fallbackDisplay?.trim() ||
    resolveCategoryDisplay(name, options)
  );
}

export function CategoriesSuggestion({
  primary,
  additional,
  primarySuggestion,
  additionalSuggestion,
  categoryOptions,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState("");

  const currentPrimaryName = primary?.name ?? "";
  const currentPrimaryLabel =
    primary?.displayName ?? primary?.name ?? null;
  const currentAdditionalNames = additional
    .map((c) => c.name)
    .filter((n): n is string => Boolean(n));

  const suggestedPrimary = primarySuggestion
    ? primarySuggestion.suggestedValue.trim()
    : currentPrimaryName;
  const suggestedAdditional = additionalSuggestion
    ? ((parseJsonArray(additionalSuggestion.suggestedValue) as string[] | null) ??
      [])
    : currentAdditionalNames;

  const [draftPrimary, setDraftPrimary] = useState(suggestedPrimary);
  const [draftAdditional, setDraftAdditional] = useState(suggestedAdditional);

  const hint =
    [primarySuggestion?.rationale, additionalSuggestion?.rationale]
      .map((t) => t?.trim())
      .filter(Boolean)
      .join(" ") || "AI proponuje zmianę kategorii.";

  const oldAdditionalSet = new Set(currentAdditionalNames);
  const newAdditionalSet = new Set(
    editing ? draftAdditional : suggestedAdditional,
  );
  const nextPrimary = editing ? draftPrimary : suggestedPrimary;
  const nextAdditional = editing ? draftAdditional : suggestedAdditional;
  const removedAdditional = currentAdditionalNames.filter(
    (n) => !newAdditionalSet.has(n),
  );
  const primaryChanged =
    nextPrimary &&
    currentPrimaryName &&
    nextPrimary !== currentPrimaryName;

  const pendingIds = [primarySuggestion?.id, additionalSuggestion?.id].filter(
    (id): id is string => Boolean(id),
  );

  function runAccept() {
    startTransition(async () => {
      for (const suggestion of [primarySuggestion, additionalSuggestion]) {
        if (!suggestion) continue;
        const editedValue =
          suggestion.field === "primary_category"
            ? draftPrimary
            : JSON.stringify(draftAdditional);
        const result = await acceptGbpSuggestion({
          suggestionId: suggestion.id,
          editedValue,
          riskAcknowledged: false,
        });
        if (!result.ok) {
          toast.error({
            title: "Nie udało się zapisać w Google",
            description: result.error,
          });
          return;
        }
      }
      toast.success({ title: "Kategorie zapisane w Google" });
      router.refresh();
    });
  }

  function runReject() {
    startTransition(async () => {
      for (const id of pendingIds) {
        const result = await rejectGbpSuggestion({
          suggestionId: id,
          reason: reason || undefined,
        });
        if (!result.ok) {
          toast.error({
            title: "Nie udało się odrzucić",
            description: result.error,
          });
          return;
        }
      }
      toast.success({ title: "Propozycja odrzucona" });
      router.refresh();
    });
  }

  return (
    <div className="wiz-inline-suggestion">
      <div className="wiz-inline-rail">
        <span className="wiz-field-label">Kategorie</span>
        <span className="wiz-ai-pill">
          <WandSparkles aria-hidden />
          Propozycja AI
        </span>
      </div>

      <div className="wiz-proposal-panel">
        {editing ? (
          <div className="wiz-compare-cols">
            <div className="wiz-compare-col">
              <div className="wiz-compare-col-head">
                <span>Obecnie</span>
              </div>
              <CategoryChips
                primaryName={currentPrimaryName}
                primaryLabel={currentPrimaryLabel}
                additionalNames={currentAdditionalNames}
                categoryOptions={categoryOptions}
                additional={additional}
              />
            </div>
            <div className="wiz-compare-col wiz-compare-col-next">
              <div className="wiz-compare-col-head">
                <span>Po zmianie</span>
              </div>
              <div className="wiz-proposal-edit wiz-cat-edit">
                <p className="wiz-cat-edit-hint">Kategoria główna</p>
                <CategorySearchPicker
                  single
                  value={draftPrimary ? [draftPrimary] : []}
                  options={categoryOptions}
                  onChange={(next) => setDraftPrimary(next[0] ?? "")}
                  placeholder="Szukaj kategorii głównej…"
                />
                <p className="wiz-cat-edit-hint">Kategorie dodatkowe</p>
                <CategorySearchPicker
                  value={draftAdditional}
                  options={categoryOptions}
                  onChange={setDraftAdditional}
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="wiz-compare-cols">
            <div className="wiz-compare-col">
              <div className="wiz-compare-col-head">
                <span>Obecnie</span>
              </div>
              <CategoryChips
                primaryName={currentPrimaryName}
                primaryLabel={currentPrimaryLabel}
                additionalNames={currentAdditionalNames}
                categoryOptions={categoryOptions}
                additional={additional}
              />
            </div>
            <div className="wiz-compare-col wiz-compare-col-next">
              <div className="wiz-compare-col-head">
                <span>Po zmianie</span>
              </div>
              <ul className="wiz-cat-chips">
                {nextPrimary ? (
                  <li>
                    <span
                      className={
                        primaryChanged
                          ? "ui-pill wiz-cat-chip-primary wiz-chip-added"
                          : "ui-pill wiz-cat-chip-primary"
                      }
                    >
                      <Star aria-hidden className="wiz-cat-chip-star" />
                      {primaryChanged ? "+ " : ""}
                      {chipLabel(nextPrimary, categoryOptions)}
                    </span>
                  </li>
                ) : null}
                {nextPrimary &&
                (nextAdditional.length > 0 || removedAdditional.length > 0) ? (
                  <li className="wiz-cat-chips-sep" aria-hidden />
                ) : null}
                {nextAdditional.map((name) => (
                  <li key={`new-${name}`}>
                    <span
                      className={
                        oldAdditionalSet.has(name)
                          ? "ui-pill wiz-cat-chip-extra"
                          : "ui-pill ui-pill-success wiz-chip-added"
                      }
                    >
                      {oldAdditionalSet.has(name) ? "" : "+ "}
                      {chipLabel(name, categoryOptions)}
                    </span>
                  </li>
                ))}
                {removedAdditional.length > 0 ? (
                  <li className="wiz-chip-removed-line">
                    Usunięte:{" "}
                    {removedAdditional
                      .map((name) =>
                        chipLabel(
                          name,
                          categoryOptions,
                          additional.find((c) => c.name === name)?.displayName,
                        ),
                      )
                      .join(", ")}
                  </li>
                ) : null}
                {!nextPrimary &&
                nextAdditional.length === 0 &&
                removedAdditional.length === 0 ? (
                  <li>
                    <span className="text-sm text-muted-foreground">Brak</span>
                  </li>
                ) : null}
              </ul>
            </div>
          </div>
        )}

        {!editing ? (
          <div className="wiz-inline-rationale">
            <span className="wiz-inline-rationale-icon-wrap" aria-hidden>
              <WandSparkles className="wiz-inline-rationale-icon" />
            </span>
            <div className="wiz-inline-rationale-body">
              <span className="wiz-inline-rationale-label">
                Dlaczego ta zmiana
              </span>
              <p>{hint}</p>
            </div>
          </div>
        ) : null}

        <div className="wiz-suggestion-actions">
          <button
            type="button"
            className="ui-btn ui-btn-outline ui-btn-sm"
            disabled={pending}
            onClick={() => setEditing((v) => !v)}
          >
            <Pencil aria-hidden />
            {editing ? "Podgląd" : "Popraw"}
          </button>
          <button
            type="button"
            className="ui-btn ui-btn-ghost ui-btn-sm"
            disabled={pending}
            onClick={() => setRejectOpen((v) => !v)}
          >
            <X aria-hidden />
            Odrzuć
          </button>
          <button
            type="button"
            className="ui-btn ui-btn-primary"
            disabled={pending}
            onClick={runAccept}
          >
            {pending ? (
              <Loader2 aria-hidden className="ui-btn-spinner" />
            ) : (
              <Check aria-hidden />
            )}
            Akceptuj
          </button>
        </div>

        {rejectOpen ? (
          <div className="wiz-reject-box">
            <label className="text-sm font-medium" htmlFor="reject-categories">
              Dlaczego odrzucasz? (opcjonalnie - dopiszemy do „czego unikać” w kontekście)
            </label>
            <textarea
              id="reject-categories"
              className="ui-textarea"
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <button
              type="button"
              className="ui-btn ui-btn-outline ui-btn-sm"
              disabled={pending}
              onClick={runReject}
            >
              Potwierdź odrzucenie
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function CategoryChips({
  primaryName,
  primaryLabel,
  additionalNames,
  additional,
  categoryOptions,
}: {
  primaryName: string;
  primaryLabel: string | null;
  additionalNames: string[];
  additional: Cat[];
  categoryOptions: Array<{ name: string; displayName: string }>;
}) {
  return (
    <ul className="wiz-cat-chips">
      {primaryName || primaryLabel ? (
        <li>
          <span className="ui-pill wiz-cat-chip-primary">
            <Star aria-hidden className="wiz-cat-chip-star" />
            {primaryLabel || chipLabel(primaryName, categoryOptions)}
          </span>
        </li>
      ) : null}
      {(primaryName || primaryLabel) && additionalNames.length > 0 ? (
        <li className="wiz-cat-chips-sep" aria-hidden />
      ) : null}
      {additionalNames.map((name) => (
        <li key={name}>
          <span className="ui-pill wiz-cat-chip-extra">
            {chipLabel(
              name,
              categoryOptions,
              additional.find((c) => c.name === name)?.displayName,
            )}
          </span>
        </li>
      ))}
      {!primaryName && !primaryLabel && additionalNames.length === 0 ? (
        <li>
          <span className="text-sm text-muted-foreground">Brak</span>
        </li>
      ) : null}
    </ul>
  );
}
