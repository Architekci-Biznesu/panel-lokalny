"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check, Loader2, Pencil, Sparkles, X } from "lucide-react";
import { toast } from "gooey-toast";
import {
  acceptGbpSuggestion,
  rejectGbpSuggestion,
} from "@/features/wizytowka/actions";
import {
  SuggestionValueEditor,
  SuggestionValuePreview,
  aiHintForSuggestion,
  currentValueForDisplay,
  parseJsonArray,
  resolveCategoryDisplay,
} from "@/features/wizytowka/components/suggestion-display";
import { PROPOSAL_META, isProposalField } from "@/features/wizytowka/proposal-meta";
import { GBP_DESCRIPTION_MAX } from "@/lib/ai/gbp-limits";
import type { GbpSuggestion } from "@/lib/db/schema";

type Props = {
  suggestion: GbpSuggestion;
  currentDisplay: string;
  categoryOptions?: Array<{ name: string; displayName: string }>;
};

function CharMeter({ value }: { value: string }) {
  const len = value.length;
  const ratio = Math.min(1, len / GBP_DESCRIPTION_MAX);
  const tone = ratio >= 0.95 ? "warn" : "ok";

  return (
    <span className="wiz-compare-meter">
      <span
        className={`wiz-compare-meter-track wiz-compare-meter-${tone}`}
        aria-hidden
      >
        <span
          className="wiz-compare-meter-fill"
          style={{ width: `${ratio * 100}%` }}
        />
      </span>
      <span className="mono wiz-compare-count">
        {len} / {GBP_DESCRIPTION_MAX}
      </span>
    </span>
  );
}

function CategoryDiff({
  current,
  next,
  categoryOptions,
}: {
  current: string;
  next: string;
  categoryOptions?: Array<{ name: string; displayName: string }>;
}) {
  const oldNames = (parseJsonArray(current) as string[] | null) ?? [];
  const newNames = (parseJsonArray(next) as string[] | null) ?? [];
  const oldSet = new Set(oldNames);
  const newSet = new Set(newNames);
  const removed = oldNames.filter((name) => !newSet.has(name));

  return (
    <div className="wiz-compare-cols">
      <div className="wiz-compare-col">
        <div className="wiz-compare-col-head">
          <span>Obecnie</span>
        </div>
        <ul className="wiz-preview-chips">
          {oldNames.length ? (
            oldNames.map((name) => (
              <li key={`old-${name}`}>
                <span className="ui-pill ui-pill-neutral">
                  {resolveCategoryDisplay(name, categoryOptions)}
                </span>
              </li>
            ))
          ) : (
            <li>
              <span className="text-sm text-muted-foreground">Brak</span>
            </li>
          )}
        </ul>
      </div>
      <div className="wiz-compare-col wiz-compare-col-next">
        <div className="wiz-compare-col-head">
          <span>Po zmianie</span>
        </div>
        <ul className="wiz-preview-chips">
          {newNames.length || removed.length ? (
            <>
              {newNames.map((name) => (
                <li key={`new-${name}`}>
                  <span
                    className={
                      oldSet.has(name)
                        ? "ui-pill ui-pill-neutral"
                        : "ui-pill ui-pill-success wiz-chip-added"
                    }
                  >
                    {oldSet.has(name) ? "" : "+ "}
                    {resolveCategoryDisplay(name, categoryOptions)}
                  </span>
                </li>
              ))}
              {removed.map((name) => (
                <li key={`rm-${name}`}>
                  <span className="ui-pill ui-pill-danger wiz-chip-removed">
                    {resolveCategoryDisplay(name, categoryOptions)}
                  </span>
                </li>
              ))}
            </>
          ) : (
            <li>
              <span className="text-sm text-muted-foreground">Brak</span>
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}

export function InlineSuggestion({
  suggestion,
  currentDisplay,
  categoryOptions,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(suggestion.suggestedValue);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [riskOpen, setRiskOpen] = useState(false);
  const isHighRisk = suggestion.risk === "high";

  const oldValue = currentValueForDisplay(
    suggestion.field,
    suggestion,
    currentDisplay,
  );
  const fieldLabel = isProposalField(suggestion.field)
    ? PROPOSAL_META[suggestion.field].label
    : suggestion.field;
  const hint =
    suggestion.rationale?.trim() || aiHintForSuggestion(suggestion);

  function runAccept(riskAcknowledged: boolean) {
    startTransition(async () => {
      const result = await acceptGbpSuggestion({
        suggestionId: suggestion.id,
        editedValue: draft,
        riskAcknowledged,
      });
      if (!result.ok) {
        toast.error({
          title: "Nie udało się zapisać w Google",
          description: result.error,
        });
        return;
      }
      toast.success({
        title: "Zmiana zapisana w Google",
        description: fieldLabel,
      });
      setRiskOpen(false);
      router.refresh();
    });
  }

  return (
    <div className="wiz-inline-suggestion">
      <div className="wiz-inline-rail">
        <span className="wiz-field-label">{fieldLabel}</span>
        <span className="wiz-ai-pill">
          <Sparkles aria-hidden />
          Propozycja AI
        </span>
      </div>

      <div className="wiz-proposal-panel">
        {editing ? (
          <div className="wiz-compare-cols">
            <div className="wiz-compare-col">
              <div className="wiz-compare-col-head">
                <span>Obecnie</span>
                {suggestion.field === "description" ? (
                  <CharMeter value={oldValue} />
                ) : null}
              </div>
              <SuggestionValuePreview
                field={suggestion.field}
                value={oldValue}
                categoryOptions={categoryOptions}
                struck
              />
            </div>
            <div className="wiz-compare-col wiz-compare-col-next">
              <div className="wiz-compare-col-head">
                <span>Po zmianie</span>
                {suggestion.field === "description" ? (
                  <CharMeter value={draft} />
                ) : null}
              </div>
              <div className="wiz-proposal-edit">
                <SuggestionValueEditor
                  field={suggestion.field}
                  value={draft}
                  onChange={setDraft}
                  categoryOptions={categoryOptions}
                />
              </div>
            </div>
          </div>
        ) : suggestion.field === "additional_categories" ? (
          <CategoryDiff
            current={oldValue}
            next={draft}
            categoryOptions={categoryOptions}
          />
        ) : (
          <div className="wiz-compare-cols">
            <div className="wiz-compare-col">
              <div className="wiz-compare-col-head">
                <span>Obecnie</span>
                {suggestion.field === "description" ? (
                  <CharMeter value={oldValue} />
                ) : null}
              </div>
              <SuggestionValuePreview
                field={suggestion.field}
                value={oldValue}
                categoryOptions={categoryOptions}
                struck
              />
            </div>
            <div className="wiz-compare-col wiz-compare-col-next">
              <div className="wiz-compare-col-head">
                <span>Po zmianie</span>
                {suggestion.field === "description" ? (
                  <CharMeter value={draft} />
                ) : null}
              </div>
              <SuggestionValuePreview
                field={suggestion.field}
                value={draft}
                categoryOptions={categoryOptions}
              />
            </div>
          </div>
        )}

        {suggestion.field === "primary_category" && !editing ? (
          <p className="wiz-suggestion-warn text-sm">
            Zmiana kategorii głównej przestawia firmę w inne wyniki wyszukiwania
            i w rzadkich przypadkach może wywołać ponowną weryfikację wizytówki.
          </p>
        ) : null}

        {!editing ? (
          <div className="wiz-inline-rationale">
            <span className="wiz-inline-rationale-icon-wrap" aria-hidden>
              <Sparkles className="wiz-inline-rationale-icon" />
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
            className="ui-btn ui-btn-primary ui-btn-sm"
            disabled={pending}
            onClick={() => {
              if (isHighRisk) {
                setRiskOpen(true);
                return;
              }
              runAccept(false);
            }}
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
            <label
              className="text-sm font-medium"
              htmlFor={`reject-${suggestion.id}`}
            >
              Dlaczego odrzucasz? (opcjonalnie - dopiszemy do „czego unikać” w kontekście)
            </label>
            <textarea
              id={`reject-${suggestion.id}`}
              className="ui-textarea"
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <button
              type="button"
              className="ui-btn ui-btn-outline ui-btn-sm"
              disabled={pending}
              onClick={() => {
                startTransition(async () => {
                  const result = await rejectGbpSuggestion({
                    suggestionId: suggestion.id,
                    reason: reason || undefined,
                  });
                  if (!result.ok) {
                    toast.error({
                      title: "Nie udało się odrzucić",
                      description: result.error,
                    });
                    return;
                  }
                  toast.success({ title: "Propozycja odrzucona" });
                  router.refresh();
                });
              }}
            >
              Potwierdź odrzucenie
            </button>
          </div>
        ) : null}

        {riskOpen ? (
          <div className="wiz-risk-dialog" role="dialog" aria-modal="true">
            <h3 className="text-base font-semibold">Ryzyko zmiany nazwy</h3>
            <p className="text-sm text-muted-foreground mt-2">
              Wytyczne Google wymagają nazwy faktycznie używanej przez firmę.
              Dodawanie słów kluczowych i lokalizacji jest ich naruszeniem. W razie
              zgłoszenia lub audytu grozi zawieszeniem wizytówki razem z opiniami, a
              odzyskanie trwa tygodniami.
            </p>
            <p className="text-sm mt-2">
              Czy tak brzmi nazwa na Twoim szyldzie lub materiałach firmowych?
            </p>
            <div className="wiz-suggestion-actions mt-3">
              <button
                type="button"
                className="ui-btn ui-btn-ghost ui-btn-sm"
                disabled={pending}
                onClick={() => setRiskOpen(false)}
              >
                Anuluj
              </button>
              <button
                type="button"
                className="ui-btn ui-btn-danger ui-btn-sm"
                disabled={pending}
                onClick={() => runAccept(true)}
              >
                {pending ? (
                  <Loader2 aria-hidden className="ui-btn-spinner" />
                ) : null}
                Rozumiem ryzyko, zmień nazwę
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
