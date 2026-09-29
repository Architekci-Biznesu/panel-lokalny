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

/** Reply mode, signature and guidelines - plus a preview that saves and publishes nothing. */
export function ReviewSettingsForm({
  initialMode,
  initialSignature,
  initialInstructions,
  autoSince,
}: {
  initialMode: ReviewMode;
  initialSignature: string;
  initialInstructions: string;
  /** When auto mode was switched on (ISO), null while off */
  autoSince: string | null;
}) {
  const router = useRouter();
  const [saving, startSave] = useTransition();
  const [previewing, startPreview] = useTransition();
  const [mode, setMode] = useState<ReviewMode>(initialMode);
  const [signature, setSignature] = useState(initialSignature);
  const [instructions, setInstructions] = useState(initialInstructions);
  const [samples, setSamples] = useState<Sample[] | null>(null);

  function save() {
    startSave(async () => {
      const result = await saveReviewSettings({
        mode,
        signature,
        instructions,
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
      const result = await previewReviewReplies({ signature, instructions });
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
