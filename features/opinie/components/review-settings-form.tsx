"use client";

import { Loader2, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "gooey-toast";
import {
  previewReviewReplies,
  saveReviewSettings,
} from "@/features/opinie/actions";
import { ReviewStars } from "@/features/opinie/components/review-stars";
import { splitReviewText } from "@/features/opinie/review-rules";
import { SAMPLE_REVIEWS } from "@/features/opinie/review-samples";
import {
  RATING_INSTRUCTION_MAX,
  RATING_KEYS,
  REPLY_PERSPECTIVES,
  REPLY_STYLES,
  normalizeRatingInstructions,
  pickRatingInstructions,
  type RatingInstructions,
  type RatingKey,
  type ReplyPerspective,
  type ReplyStyle,
} from "@/features/opinie/review-settings";
import {
  reviewReplySystemPrompt,
  reviewReplyUserPrompt,
} from "@/lib/ai/review-prompts";
import type { BriefFields } from "@/lib/ai/types";
import type { ReviewMode } from "@/lib/db/schema";

const SINCE_FMT = new Intl.DateTimeFormat("pl-PL", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Warsaw",
});

type Sample = { rating: number; review: string; reply: string };

/** What the profile contributes to every prompt (from the server; the rest comes from the form). */
export type PromptContext = {
  businessName: string;
  brief: BriefFields;
  avoid: string | null;
  phone: string | null;
};

/** Reply mode, signature and guidelines - plus a preview that saves and publishes nothing. */
export function ReviewSettingsForm({
  initialMode,
  initialSignature,
  initialInstructions,
  initialPerspective,
  initialStyle,
  initialRatingInstructions,
  promptContext,
  autoSince,
}: {
  initialMode: ReviewMode;
  initialSignature: string;
  initialInstructions: string;
  initialPerspective: ReplyPerspective;
  initialStyle: ReplyStyle;
  initialRatingInstructions: RatingInstructions;
  promptContext: PromptContext;
  /** When auto mode was switched on (ISO), null while off */
  autoSince: string | null;
}) {
  const router = useRouter();
  const [saving, startSave] = useTransition();
  const [previewing, startPreview] = useTransition();
  const [mode, setMode] = useState<ReviewMode>(initialMode);
  const [signature, setSignature] = useState(initialSignature);
  const [instructions, setInstructions] = useState(initialInstructions);
  const [ratingInstructions, setRatingInstructions] =
    useState<RatingInstructions>(initialRatingInstructions);
  const [perspective, setPerspective] =
    useState<ReplyPerspective>(initialPerspective);
  const [style, setStyle] = useState<ReplyStyle>(initialStyle);
  const [activeRating, setActiveRating] = useState<RatingKey>("5");
  // Preview of a review with text, or stars only (the two scenarios differ)
  const [withText, setWithText] = useState(true);
  const [samples, setSamples] = useState<Sample[] | null>(null);

  // The very same builder the AI call uses, fed with this form's current values -
  // so the preview cannot drift from what is really sent.
  const sample = SAMPLE_REVIEWS[activeRating];
  const activeNumber = Number(activeRating);
  const promptPreview = reviewReplyUserPrompt({
    businessName: promptContext.businessName,
    brief: promptContext.brief,
    avoid: promptContext.avoid,
    phone: promptContext.phone,
    rating: activeNumber,
    authorName: sample.authorName,
    reviewText: withText ? splitReviewText(sample.text).original : null,
    instructions: instructions.trim() || null,
    ratingInstructions: pickRatingInstructions(
      normalizeRatingInstructions(ratingInstructions),
      activeNumber,
    ),
  });
  const systemPreview = reviewReplySystemPrompt({
    rating: activeNumber,
    hasText: withText,
    perspective,
    style,
  });

  function save() {
    startSave(async () => {
      const result = await saveReviewSettings({
        mode,
        signature,
        instructions,
        perspective,
        style,
        ratingInstructions,
      });
      if (!result.ok) {
        toast.error({
          title: "Nie zapisano ustawień",
          description: result.error,
        });
        return;
      }
      toast.success({ title: "Ustawienia opinii zapisane" });
      router.refresh();
    });
  }

  function preview() {
    startPreview(async () => {
      const result = await previewReviewReplies({
        signature,
        instructions,
        perspective,
        style,
        ratingInstructions,
      });
      if (!result.ok) {
        toast.error({
          title: "Nie udało się przygotować przykładu",
          description: result.error,
        });
        return;
      }
      setSamples(result.samples);
    });
  }

  return (
    <form
      className="op-settings"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
    >
      <section className="op-settings-block">
        <h2 className="op-settings-title">Tryb pracy</h2>
        <div className="ui-seg" role="group" aria-label="Tryb pracy">
          <button
            type="button"
            className={`ui-seg-item${mode === "accept" ? " is-active" : ""}`}
            aria-pressed={mode === "accept"}
            onClick={() => setMode("accept")}
          >
            Akceptuję każdą odpowiedź
          </button>
          <button
            type="button"
            className={`ui-seg-item${mode === "auto" ? " is-active" : ""}`}
            aria-pressed={mode === "auto"}
            onClick={() => setMode("auto")}
          >
            Automatycznie dla ocen 3-5
          </button>
        </div>
        <ul className="op-rules">
          <li>
            Opinie 1-2 gwiazdki zawsze czekają na Twoją decyzję - odpowiedź jest
            gotowa, ale publikujesz ją Ty.
          </li>
          <li>
            Opinie sprzed włączenia trybu automatycznego nie zostaną ruszone.
          </li>
          <li>
            Automatycznie odpowiadamy tylko na opinie 3-5 gwiazdek, także te bez
            treści.
          </li>
        </ul>
        <p className="op-settings-note">
          Odpowiedzi automatyczne są wysyłane przy każdym sprawdzeniu nowych
          opinii (po wejściu w Opinie albo kliknięciu „Odśwież”).
          {autoSince && initialMode === "auto"
            ? ` Tryb włączony od ${SINCE_FMT.format(new Date(autoSince))}.`
            : ""}
        </p>
      </section>

      <section className="op-settings-block">
        <label className="op-settings-title" htmlFor="op-signature">
          Podpis pod odpowiedziami
        </label>
        <input
          id="op-signature"
          className="ui-field"
          value={signature}
          maxLength={120}
          placeholder="Np. Zespół Pizzerii Roma"
          disabled={saving}
          onChange={(event) => setSignature(event.target.value)}
        />
        <p className="op-settings-note">
          Jedna linia dodawana na końcu każdej odpowiedzi.
        </p>
      </section>

      <section className="op-settings-block">
        <h2 className="op-settings-title">Perspektywa i styl odpowiedzi</h2>
        <div className="ui-seg" role="group" aria-label="Perspektywa">
          {REPLY_PERSPECTIVES.map((item) => (
            <button
              key={item.value}
              type="button"
              className={`ui-seg-item${perspective === item.value ? " is-active" : ""}`}
              aria-pressed={perspective === item.value}
              onClick={() => setPerspective(item.value)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="ui-seg" role="group" aria-label="Styl">
          {REPLY_STYLES.map((item) => (
            <button
              key={item.value}
              type="button"
              className={`ui-seg-item${style === item.value ? " is-active" : ""}`}
              aria-pressed={style === item.value}
              onClick={() => setStyle(item.value)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <p className="op-settings-note">
          Perspektywa i styl dotyczą odpowiedzi na opinie 3-5 gwiazdek. Krótkie
          odpowiedzi bez treści opinii (same gwiazdki) piszemy według stałego
          wzoru w wybranej perspektywie.
        </p>
      </section>

      <section className="op-settings-block">
        <label className="op-settings-title" htmlFor="op-instructions">
          Instrukcje do odpowiedzi
        </label>
        <textarea
          id="op-instructions"
          className="ui-textarea"
          rows={5}
          value={instructions}
          maxLength={1500}
          placeholder="Np. zwracaj się do klientów per Pan/Pani, zawsze wspominaj o możliwości rezerwacji online"
          disabled={saving}
          onChange={(event) => setInstructions(event.target.value)}
        />
        <p className="op-settings-note">
          Te wytyczne dotyczą każdej generowanej odpowiedzi. Twardych zasad nie
          da się tu wyłączyć: nie potwierdzamy, że autor był Twoim klientem, nie
          obiecujemy rabatów ani zwrotów, nie przyznajemy się do winy i nie
          wdajemy się w spór. Przy ocenach 1-2 zapraszamy do kontaktu poza
          Google.
        </p>
      </section>

      <section className="op-settings-block">
        <h2 className="op-settings-title">Wytyczne dla poszczególnych ocen</h2>
        <p className="op-settings-note">
          Dodatkowe wytyczne stosowane tylko do odpowiedzi na opinię o wybranej
          liczbie gwiazdek, obok wytycznych wspólnych powyżej. Twarde zasady
          nadal obowiązują.
        </p>
        <div className="ui-seg" role="group" aria-label="Ocena">
          {RATING_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              className={`ui-seg-item${activeRating === key ? " is-active" : ""}`}
              aria-pressed={activeRating === key}
              onClick={() => setActiveRating(key)}
            >
              {key}
              <span aria-hidden>★</span>
              {ratingInstructions[key]?.trim() ? (
                <span className="op-rating-dot" title="Ustawione wytyczne" />
              ) : null}
            </button>
          ))}
        </div>
        <label className="sr-only" htmlFor="op-rating-instructions">
          Wytyczne dla oceny {activeRating} z 5 gwiazdek
        </label>
        <textarea
          id="op-rating-instructions"
          className="ui-textarea"
          rows={4}
          value={ratingInstructions[activeRating] ?? ""}
          maxLength={RATING_INSTRUCTION_MAX}
          placeholder={
            activeNumber <= 2
              ? "Np. podaj adres e-mail do reklamacji i zaproś do rozmowy"
              : "Np. zaproś na kolejną wizytę i wspomnij o rezerwacji online"
          }
          disabled={saving}
          onChange={(event) =>
            setRatingInstructions((current) => ({
              ...current,
              [activeRating]: event.target.value,
            }))
          }
        />
        <span className="op-counter mono">
          {(ratingInstructions[activeRating] ?? "").length} /{" "}
          {RATING_INSTRUCTION_MAX}
        </span>

        <h3 className="op-prompt-title">
          Prompt dla oceny {activeRating} z 5 gwiazdek
        </h3>
        <div className="ui-seg" role="group" aria-label="Rodzaj opinii">
          <button
            type="button"
            className={`ui-seg-item${withText ? " is-active" : ""}`}
            aria-pressed={withText}
            onClick={() => setWithText(true)}
          >
            Opinia z treścią
          </button>
          <button
            type="button"
            className={`ui-seg-item${withText ? "" : " is-active"}`}
            aria-pressed={!withText}
            onClick={() => setWithText(false)}
          >
            Same gwiazdki
          </button>
        </div>
        <p className="op-settings-note">
          To dokładnie to, co dostaje AI przy opinii z taką oceną (przykładowa
          opinia poniżej). Zmienia się na żywo przy edycji pól. Podpis
          {signature.trim() ? ` „${signature.trim()}”` : ""} system dopisuje sam
          po odpowiedzi AI.
        </p>
        <pre className="op-prompt mono">{promptPreview}</pre>
        <details className="op-prompt-rules">
          <summary>Zasady stałe i wzór odpowiedzi (nie do zmiany)</summary>
          <pre className="op-prompt mono">{systemPreview}</pre>
        </details>
      </section>

      <section className="op-settings-block">
        <h2 className="op-settings-title">Podgląd</h2>
        <div>
          <button
            type="button"
            className="ui-btn ui-btn-white ui-btn-sm"
            disabled={previewing}
            onClick={preview}
          >
            {previewing ? (
              <Loader2 aria-hidden className="ui-btn-spinner" />
            ) : (
              <Sparkles aria-hidden />
            )}
            Pokaż przykładową odpowiedź
          </button>
        </div>
        {samples ? (
          <ul className="op-samples">
            {samples.map((sample) => (
              <li key={sample.rating} className="op-sample">
                <p className="op-meta">
                  <ReviewStars rating={sample.rating} />
                  <span className="op-sample-tag">przykładowa opinia</span>
                </p>
                <p className="op-sample-review">{sample.review}</p>
                <p className="op-reply-label">Odpowiedź</p>
                <p className="op-reply-text">{sample.reply}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="op-settings-note">
            Zobaczysz odpowiedź na przykładową opinię 5 i 2 gwiazdkową z
            bieżącymi ustawieniami. Nic nie jest zapisywane ani publikowane.
          </p>
        )}
      </section>

      <div className="op-settings-foot">
        <button
          type="submit"
          className="ui-btn ui-btn-primary"
          disabled={saving}
        >
          {saving ? <Loader2 aria-hidden className="ui-btn-spinner" /> : null}
          Zapisz ustawienia
        </button>
      </div>
    </form>
  );
}
