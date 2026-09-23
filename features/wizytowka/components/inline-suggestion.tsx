"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check, Loader2, Pencil, WandSparkles, X } from "lucide-react";
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
} from "@/features/wizytowka/components/suggestion-display";
import type { GbpSuggestion } from "@/lib/db/schema";

const FIELD_LABELS: Record<string, string> = {
  title: "Nazwa firmy",
  description: "Opis",
  primary_category: "Kategoria główna",
  additional_categories: "Kategorie dodatkowe",
  services: "Usługi",
};

type Props = {
  suggestion: GbpSuggestion;
  currentDisplay: string;
  categoryOptions?: Array<{ name: string; displayName: string }>;
};

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
        description: FIELD_LABELS[suggestion.field] ?? suggestion.field,
      });
      setRiskOpen(false);
      router.refresh();
    });
  }

  return (
    <div
      className={`wiz-inline-suggestion ${isHighRisk ? "wiz-inline-suggestion-risk" : ""}`}
    >
      {editing ? (
        <SuggestionValueEditor
          field={suggestion.field}
          value={draft}
          onChange={setDraft}
        />
      ) : (
        <>
          <SuggestionValuePreview
            field={suggestion.field}
            value={oldValue}
            categoryOptions={categoryOptions}
            struck
          />
          <p className="wiz-inline-ai">
            <WandSparkles aria-hidden className="wiz-inline-ai-icon" />
            <span>{aiHintForSuggestion(suggestion)}</span>
          </p>
          {suggestion.field === "primary_category" ? (
            <p className="wiz-suggestion-warn text-sm">
              Zmiana kategorii głównej przestawia firmę w inne wyniki
              wyszukiwania i w rzadkich przypadkach może wywołać ponowną
              weryfikację wizytówki.
            </p>
          ) : null}
          <SuggestionValuePreview
            field={suggestion.field}
            value={draft}
            categoryOptions={categoryOptions}
          />
        </>
      )}

      <div className="wiz-suggestion-actions">
        <button
          type="button"
          className="ui-btn ui-btn-ghost ui-btn-sm"
          disabled={pending}
          onClick={() => setEditing((v) => !v)}
        >
          <Pencil aria-hidden />
          {editing ? "Podgląd" : "Popraw"}
        </button>
        <button
          type="button"
          className="ui-btn ui-btn-outline ui-btn-sm"
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
            Dlaczego odrzucasz? (opcjonalnie - dopiszemy do „czego unikać”)
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
  );
}
