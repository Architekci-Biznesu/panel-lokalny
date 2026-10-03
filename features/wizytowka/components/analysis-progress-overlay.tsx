"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Sparkles } from "lucide-react";

const STEPS = [
  "Pobieranie danych wizytówki",
  "Sprawdzanie konkurencji w Google",
  "Analiza AI (nazwa, opis, kategorie)",
  "Przygotowywanie propozycji",
] as const;

/**
 * Rotated while on the last main step. ~100 s audits need a fresh line every
 * SUBSTEP_MS after the early STEPS finish (~7.5 s) → ~10 labels.
 * Alternating „Analiza …” / „Sprawdzanie …”.
 */
const FINAL_SUBSTEPS = [
  "Analiza nazwy wizytówki",
  "Sprawdzanie opisu wizytówki",
  "Analiza kategorii głównej",
  "Sprawdzanie kategorii dodatkowych",
  "Analiza konkurencji w okolicy",
  "Sprawdzanie zdjęć i galerii",
  "Analiza godzin otwarcia",
  "Sprawdzanie luk w Local Pack",
  "Analiza fraz rankingowych",
  "Finalizacja listy do decyzji",
] as const;

const STEP_MS = 2500;
const SUBSTEP_MS = 8000;

export function AnalysisProgressOverlay({ active }: { active: boolean }) {
  const [stepIndex, setStepIndex] = useState(0);
  const [substepIndex, setSubstepIndex] = useState(0);
  const [wasActive, setWasActive] = useState(active);

  // Każde nowe uruchomienie zaczyna od pierwszego kroku (reset w renderze, bez setState w efekcie).
  if (active !== wasActive) {
    setWasActive(active);
    setStepIndex(0);
    setSubstepIndex(0);
  }

  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => {
      setStepIndex((prev) => Math.min(prev + 1, STEPS.length - 1));
    }, STEP_MS);
    return () => window.clearInterval(id);
  }, [active]);

  useEffect(() => {
    if (!active || stepIndex !== STEPS.length - 1) return;
    setSubstepIndex(0);
    const id = window.setInterval(() => {
      setSubstepIndex((prev) =>
        Math.min(prev + 1, FINAL_SUBSTEPS.length - 1),
      );
    }, SUBSTEP_MS);
    return () => window.clearInterval(id);
  }, [active, stepIndex]);

  // Nakładka pojawia się tylko po akcji użytkownika, więc document zawsze istnieje.
  if (!active || typeof document === "undefined") return null;

  const onFinalStep = stepIndex === STEPS.length - 1;
  const headline = onFinalStep
    ? FINAL_SUBSTEPS[substepIndex]
    : STEPS[stepIndex];
  const headlineKey = onFinalStep
    ? `sub-${substepIndex}`
    : `step-${stepIndex}`;

  return createPortal(
    <div
      className="app-profile-switch-overlay wiz-analysis"
      role="status"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="wiz-analysis-stage">
        <div className="wiz-analysis-radar" aria-hidden>
          <span className="wiz-analysis-wave" />
          <span className="wiz-analysis-wave" />
          <span className="wiz-analysis-wave" />
          <span className="wiz-analysis-core">
            <Sparkles />
          </span>
        </div>

        <p className="wiz-analysis-kicker">Analiza wizytówki</p>
        {/* key: każdy nowy krok / podkrok wjeżdża od nowa */}
        <p key={headlineKey} className="wiz-analysis-now">
          {headline}
        </p>

        <ol className="wiz-analysis-track" aria-label="Postęp analizy">
          {STEPS.map((label, index) => (
            <li
              key={label}
              className={`wiz-analysis-seg${index < stepIndex ? " is-done" : ""}${index === stepIndex ? " is-current" : ""}`}
            >
              <span className="sr-only">
                {label}
                {index < stepIndex
                  ? " - gotowe"
                  : index === stepIndex
                    ? " - w toku"
                    : ""}
              </span>
            </li>
          ))}
        </ol>

        <p className="wiz-analysis-foot">
          Krok <span className="mono">{stepIndex + 1}</span> z{" "}
          <span className="mono">{STEPS.length}</span> · działa też po zamknięciu strony
        </p>
      </div>
    </div>,
    document.body,
  );
}
