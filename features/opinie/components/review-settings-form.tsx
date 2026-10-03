"use client";

import {
  ChevronDown,
  ChevronRight,
  Hand,
  Loader2,
  MessageCircle,
  ShieldCheck,
  Signature,
  Sparkles,
  Zap,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "@/lib/toast";
import { SaveBar } from "@/components/ui/save-bar";
import {
  previewReviewReply,
  saveReviewSettings,
} from "@/features/opinie/actions";
import { ReviewStars } from "@/features/opinie/components/review-stars";
import { splitReviewText } from "@/features/opinie/review-rules";
import { SAMPLE_REVIEWS } from "@/features/opinie/review-samples";
import {
  RATING_INSTRUCTION_MAX,
  RATING_KEYS,
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

/** Ratings listed from the best, like the rating spread on the list. */
const RATINGS_DESC = [...RATING_KEYS].reverse();

/** What the profile contributes to every prompt (from the server; the rest comes from the form). */
export type PromptContext = {
  businessName: string;
  brief: BriefFields;
  avoid: string | null;
  phone: string | null;
};

type Settings = {
  mode: ReviewMode;
  signature: string;
  instructions: string;
  perspective: ReplyPerspective;
  style: ReplyStyle;
  ratingInstructions: RatingInstructions;
};

/** The same settings, whatever the order of keys or the empty entries. */
function settingsKey(settings: Settings): string {
  return JSON.stringify({
    ...settings,
    signature: settings.signature.trim(),
    instructions: settings.instructions.trim(),
    ratingInstructions: normalizeRatingInstructions(
      settings.ratingInstructions,
    ),
  });
}

/** A short example of how the voice settings sound (not generated - fixed phrases). */
function voiceSample(
  perspective: ReplyPerspective,
  style: ReplyStyle,
): { thanks: string; body: string } {
  const team = perspective === "team";
  return {
    thanks: team ? "Dziękujemy" : "Dziękuję",
    body:
      style === "warm"
        ? "Super, że wszystko poszło sprawnie - do zobaczenia!"
        : team
          ? "Cieszy nas, że współpraca przebiegła zgodnie z oczekiwaniami."
          : "Cieszy mnie, że współpraca przebiegła zgodnie z oczekiwaniami.",
  };
}

function SettingsBlock({
  number,
  title,
  description,
  footer,
  children,
}: {
  number: number;
  title: string;
  description: string;
  /** Strip along the bottom edge of the tile (full width) */
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="op-block">
      <header className="op-block-head">
        <span className="op-block-num mono" aria-hidden>
          {number}
        </span>
        <div>
          <h2 className="op-block-title">{title}</h2>
          <p className="op-block-desc">{description}</p>
        </div>
      </header>
      <div className="op-block-body">{children}</div>
      {footer}
    </section>
  );
}

/**
 * Reply mode, voice and guidelines - with a live preview on the side that
 * saves and publishes nothing.
 */
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
  // One rating at a time: the open guidelines row and the preview follow it.
  const [activeRating, setActiveRating] = useState<RatingKey>("5");
  const [openRating, setOpenRating] = useState<RatingKey | null>(null);
  // Preview of a review with text, or stars only (the two scenarios differ)
  const [withText, setWithText] = useState(true);
  const [sample, setSample] = useState<{ key: string; reply: string } | null>(
    null,
  );

  const initial: Settings = {
    mode: initialMode,
    signature: initialSignature,
    instructions: initialInstructions,
    perspective: initialPerspective,
    style: initialStyle,
    ratingInstructions: initialRatingInstructions,
  };
  const current: Settings = {
    mode,
    signature,
    instructions,
    perspective,
    style,
    ratingInstructions,
  };
  const dirty = settingsKey(current) !== settingsKey(initial);
  // The sample reply belongs to these settings, this rating and review type.
  const previewKey = `${settingsKey({ ...current, mode: "accept" })}:${activeRating}:${withText}`;
  const sampleReply = sample?.key === previewKey ? sample.reply : null;
  const sampleStale = sample !== null && sample.key !== previewKey;

  // The very same builder the AI call uses, fed with this form's current values -
  // so the preview cannot drift from what is really sent.
  const review = SAMPLE_REVIEWS[activeRating];
  const activeNumber = Number(activeRating);
  const promptPreview = reviewReplyUserPrompt({
    businessName: promptContext.businessName,
    brief: promptContext.brief,
    avoid: promptContext.avoid,
    phone: promptContext.phone,
    rating: activeNumber,
    authorName: review.authorName,
    reviewText: withText ? splitReviewText(review.text).original : null,
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
  const voice = voiceSample(perspective, style);

  function reset() {
    setMode(initialMode);
    setSignature(initialSignature);
    setInstructions(initialInstructions);
    setRatingInstructions(initialRatingInstructions);
    setPerspective(initialPerspective);
    setStyle(initialStyle);
  }

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
    const key = previewKey;
    startPreview(async () => {
      const result = await previewReviewReply({
        signature,
        instructions,
        perspective,
        style,
        ratingInstructions,
        rating: activeNumber,
        withText,
      });
      if (!result.ok) {
        toast.error({
          title: "Nie udało się przygotować przykładu",
          description: result.error,
        });
        return;
      }
      setSample({ key, reply: result.reply });
    });
  }

  function toggleRating(key: RatingKey) {
    setOpenRating((open) => (open === key ? null : key));
    setActiveRating(key);
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
      <div className="op-settings-main">
        <SettingsBlock
          number={1}
          title="Tryb pracy"
          description="Kto publikuje odpowiedzi w Google"
          footer={
            <div className="op-block-foot is-note">
              <span className="op-foot-icon" aria-hidden>
                <ShieldCheck />
              </span>
              <p className="op-foot-text">
                Opinie 1-2 zawsze czekają na Twoją decyzję. Tryb automatyczny
                nie rusza opinii sprzed włączenia. W trybie automatycznym
                sprawdzamy opinie co 30 minut i odpowiadamy bez otwierania
                panelu.
                {autoSince && initialMode === "auto"
                  ? ` Tryb włączony od ${SINCE_FMT.format(new Date(autoSince))}.`
                  : ""}
              </p>
            </div>
          }
        >
          <div className="op-modes" role="radiogroup" aria-label="Tryb pracy">
            <button
              type="button"
              role="radio"
              aria-checked={mode === "accept"}
              className={`op-mode${mode === "accept" ? " is-active" : ""}`}
              onClick={() => setMode("accept")}
            >
              <span className="op-mode-icon" aria-hidden>
                <Hand />
              </span>
              <span className="op-mode-text">
                <span className="op-mode-name">Akceptuję każdą odpowiedź</span>
                <span className="op-mode-hint">
                  AI przygotowuje szkic do każdej opinii, a Ty publikujesz
                  jednym kliknięciem.
                </span>
              </span>
              <span className="op-radio" aria-hidden />
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={mode === "auto"}
              className={`op-mode${mode === "auto" ? " is-active" : ""}`}
              onClick={() => setMode("auto")}
            >
              <span className="op-mode-icon" aria-hidden>
                <Zap />
              </span>
              <span className="op-mode-text">
                <span className="op-mode-name">Automatycznie dla ocen 3-5</span>
                <span className="op-mode-hint">
                  Odpowiedzi na 3-5 gwiazdek (także bez treści) publikujemy
                  sami. 1-2 zawsze czekają na Ciebie.
                </span>
              </span>
              <span className="op-radio" aria-hidden />
            </button>
          </div>
        </SettingsBlock>

        <SettingsBlock
          number={2}
          title="Jak odpowiadamy"
          description="Głos marki w każdej odpowiedzi"
          footer={
            <div className="op-block-foot is-voice">
              <span className="op-foot-icon" aria-hidden>
                <MessageCircle />
              </span>
              <div className="op-voice-text">
                <span className="op-voice-label">Tak to zabrzmi</span>
                <p>
                  <mark>{voice.thanks}</mark> za opinię!{" "}
                  <mark>{voice.body}</mark>
                  {signature.trim() ? (
                    <>
                      <br />
                      <mark className="is-signature">{signature.trim()}</mark>
                    </>
                  ) : null}
                </p>
              </div>
            </div>
          }
        >
          <div className="op-rows">
            <div className="op-rows-head" aria-hidden>
              <span>Ustawienie</span>
              <span>Wybór</span>
            </div>
            <div className="op-row">
              <div className="op-row-text">
                <span className="op-row-name" id="op-perspective">
                  Kto odpowiada
                </span>
                <span className="op-row-hint">
                  My czy ja - forma w całej odpowiedzi
                </span>
              </div>
              <div
                className="ui-seg op-seg-soft"
                role="group"
                aria-labelledby="op-perspective"
              >
                {(
                  [
                    ["team", "Zespół"],
                    ["owner", "Właściciel"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className={`ui-seg-item${perspective === value ? " is-active" : ""}`}
                    aria-pressed={perspective === value}
                    onClick={() => setPerspective(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="op-row">
              <div className="op-row-text">
                <span className="op-row-name" id="op-style">
                  Styl
                </span>
                <span className="op-row-hint">
                  Dla ocen 3-5 z treścią; same gwiazdki mają stały wzór
                </span>
              </div>
              <div
                className="ui-seg op-seg-soft"
                role="group"
                aria-labelledby="op-style"
              >
                {(
                  [
                    ["warm", "Ciepły"],
                    ["formal", "Formalny"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className={`ui-seg-item${style === value ? " is-active" : ""}`}
                    aria-pressed={style === value}
                    onClick={() => setStyle(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="op-row">
              <div className="op-row-text">
                <label className="op-row-name" htmlFor="op-signature">
                  Podpis
                </label>
                <span className="op-row-hint">
                  Dopisywany na końcu każdej odpowiedzi
                </span>
              </div>
              <span className="op-signature">
                <Signature aria-hidden />
                <input
                  id="op-signature"
                  value={signature}
                  maxLength={120}
                  placeholder="Np. Zespół Pizzerii Roma"
                  disabled={saving}
                  onChange={(event) => setSignature(event.target.value)}
                />
              </span>
            </div>
          </div>
        </SettingsBlock>

        <SettingsBlock
          number={3}
          title="Wytyczne dla AI"
          description="Co ma się pojawić w odpowiedziach - ogólnie i dla konkretnych ocen"
          footer={
            <div className="op-block-foot is-note">
              <span className="op-foot-icon" aria-hidden>
                <ShieldCheck />
              </span>
              <details className="op-fixed-rules op-foot-text">
                <summary>
                  Zasady stałe (nie do zmiany)
                  <ChevronDown aria-hidden className="op-fold-chevron" />
                </summary>
                <p>
                  Nie potwierdzamy, że autor był Twoim klientem, nie obiecujemy
                  rabatów ani zwrotów, nie przyznajemy się do winy i nie wdajemy
                  się w spór. Przy ocenach 1-2 zapraszamy do kontaktu poza
                  Google. Pełny wzór dla oceny {activeRating}
                  {withText ? " z treścią" : " bez treści"}:
                </p>
                <pre className="op-prompt mono">{systemPreview}</pre>
              </details>
            </div>
          }
        >
          <div className="op-field">
            <label className="op-row-name" htmlFor="op-instructions">
              Dla wszystkich ocen
            </label>
            <textarea
              id="op-instructions"
              className="ui-textarea"
              rows={3}
              value={instructions}
              maxLength={1500}
              placeholder="Np. zwracaj się do klientów per Pan/Pani, zawsze wspominaj o możliwości rezerwacji online"
              disabled={saving}
              onChange={(event) => setInstructions(event.target.value)}
            />
          </div>

          <div className="op-field">
            <span className="op-row-name" id="op-rating-rules">
              Dla konkretnej oceny
            </span>
            <ul className="op-ratings" aria-labelledby="op-rating-rules">
              {RATINGS_DESC.map((key) => {
                const text = ratingInstructions[key] ?? "";
                const open = openRating === key;
                const set = text.trim().length > 0;
                return (
                  <li
                    key={key}
                    className={`op-rating${open ? " is-open" : ""}`}
                  >
                    <button
                      type="button"
                      className="op-rating-head"
                      aria-expanded={open}
                      aria-controls={`op-rating-${key}`}
                      onClick={() => toggleRating(key)}
                    >
                      <ReviewStars rating={Number(key)} size="sm" />
                      <span
                        className={`op-rating-preview${set ? "" : " is-empty"}`}
                      >
                        {open
                          ? `Wytyczne dla oceny ${key}`
                          : set
                            ? text
                            : "Brak - AI użyje wytycznych ogólnych"}
                      </span>
                      <span className="op-rating-action">
                        {open ? "Zwiń" : set ? "Edytuj" : "Dodaj"}
                        {open ? (
                          <ChevronDown aria-hidden />
                        ) : (
                          <ChevronRight aria-hidden />
                        )}
                      </span>
                    </button>
                    {open ? (
                      <div className="op-rating-body" id={`op-rating-${key}`}>
                        <label className="sr-only" htmlFor={`op-rt-${key}`}>
                          Wytyczne dla oceny {key} z 5 gwiazdek
                        </label>
                        <textarea
                          id={`op-rt-${key}`}
                          className="ui-textarea"
                          rows={3}
                          value={text}
                          maxLength={RATING_INSTRUCTION_MAX}
                          placeholder={
                            Number(key) <= 2
                              ? "Np. podaj adres e-mail do reklamacji i zaproś do rozmowy"
                              : "Np. zaproś na kolejną wizytę i wspomnij o rezerwacji online"
                          }
                          disabled={saving}
                          onChange={(event) =>
                            setRatingInstructions((value) => ({
                              ...value,
                              [key]: event.target.value,
                            }))
                          }
                        />
                        <span className="op-rating-foot">
                          <span>
                            Dopisywane do promptu tylko dla opinii z oceną {key}
                            .
                          </span>
                          <span className="mono">
                            {text.length} / {RATING_INSTRUCTION_MAX}
                          </span>
                        </span>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
            <span className="op-row-hint">
              Uzupełniają wytyczne ogólne - nie trzeba ustawiać wszystkich.
            </span>
          </div>
        </SettingsBlock>
      </div>

      <aside className="op-preview" aria-label="Podgląd odpowiedzi">
        <header className="op-preview-head">
          <h2 className="op-block-title">Podgląd odpowiedzi</h2>
          <p className="op-block-desc">
            Na żywo z bieżących ustawień - nic nie jest publikowane
          </p>
        </header>
        <div className="op-preview-body">
          <div className="op-preview-controls">
            <div className="ui-seg op-seg-soft" role="group" aria-label="Ocena">
              {RATINGS_DESC.map((key) => (
                <button
                  key={key}
                  type="button"
                  className={`ui-seg-item${activeRating === key ? " is-active" : ""}`}
                  aria-pressed={activeRating === key}
                  onClick={() => setActiveRating(key)}
                >
                  {key}
                  <span aria-hidden>★</span>
                </button>
              ))}
            </div>
            <div
              className="ui-seg op-seg-soft"
              role="group"
              aria-label="Rodzaj opinii"
            >
              <button
                type="button"
                className={`ui-seg-item${withText ? " is-active" : ""}`}
                aria-pressed={withText}
                onClick={() => setWithText(true)}
              >
                Z treścią
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
          </div>

          <div className="op-sample">
            <div className="op-sample-head">
              <span className="op-sample-avatar" aria-hidden>
                {review.authorName.charAt(0)}
              </span>
              <div className="op-sample-who">
                <span className="op-author-name">{review.authorName}</span>
                <ReviewStars rating={activeNumber} size="sm" />
              </div>
              <span className="op-sample-tag">przykład</span>
            </div>
            <p className={`op-sample-text${withText ? "" : " is-empty"}`}>
              {withText
                ? splitReviewText(review.text).original
                : "Same gwiazdki, bez treści."}
            </p>
          </div>

          <div className="op-sample-reply" aria-live="polite">
            <p className="op-reply-label is-ai">
              <Sparkles aria-hidden />
              Odpowiedź AI
            </p>
            {previewing ? (
              <>
                <span
                  className="ui-skel"
                  style={{ width: "100%", height: "0.75rem" }}
                />
                <span
                  className="ui-skel"
                  style={{ width: "80%", height: "0.75rem" }}
                />
              </>
            ) : sampleReply ? (
              <p className="op-reply-text">{sampleReply}</p>
            ) : (
              <p className="op-row-hint">
                {sampleStale
                  ? "Ustawienia albo ocena się zmieniły - wygeneruj odpowiedź ponownie."
                  : "Zobacz, jak AI odpowie na tę opinię z bieżącymi ustawieniami. Nic nie jest zapisywane."}
              </p>
            )}
          </div>

          <button
            type="button"
            className="ui-btn ui-btn-primary op-preview-btn"
            disabled={previewing}
            onClick={preview}
          >
            {previewing ? (
              <Loader2 aria-hidden className="ui-btn-spinner" />
            ) : (
              <Sparkles aria-hidden />
            )}
            {sampleReply ? "Wygeneruj ponownie" : "Wygeneruj odpowiedź"}
          </button>
        </div>
        <details className="op-preview-prompt">
          <summary>
            Prompt dla AI (ocena {activeRating},{" "}
            {withText ? "z treścią" : "same gwiazdki"})
            <ChevronRight aria-hidden />
          </summary>
          <p className="op-row-hint">
            To dokładnie to, co dostaje AI. Podpis
            {signature.trim() ? ` „${signature.trim()}”` : ""} system dopisuje
            sam po odpowiedzi AI.
          </p>
          <pre className="op-prompt mono">{promptPreview}</pre>
        </details>
      </aside>

      {dirty ? (
        <SaveBar
          message="Niezapisane zmiany"
          onUndo={reset}
          saveLabel="Zapisz ustawienia"
          pending={saving}
        />
      ) : null}
    </form>
  );
}
