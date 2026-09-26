"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Check } from "lucide-react";

const STEPS = [
  "Pobieranie danych wizytówki",
  "Sprawdzanie konkurencji w Google",
  "Analiza AI (nazwa, opis, kategorie)",
  "Przygotowywanie propozycji",
] as const;

const STEP_MS = 2500;

export function AnalysisProgressOverlay({ active }: { active: boolean }) {
  const [mounted, setMounted] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!active) {
      setStepIndex(0);
      return;
    }
    setStepIndex(0);
    const id = window.setInterval(() => {
      setStepIndex((prev) => Math.min(prev + 1, STEPS.length - 1));
    }, STEP_MS);
    return () => window.clearInterval(id);
  }, [active]);

  if (!mounted || !active) return null;

  return createPortal(
    <div
      className="app-profile-switch-overlay"
      role="status"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="app-profile-switch-content wiz-analysis-overlay">
        <svg
          aria-hidden
          className="app-profile-switch-spinner"
          viewBox="0 0 50 50"
        >
          <circle
            className="app-profile-switch-track"
            cx="25"
            cy="25"
            r="20"
          />
          <circle className="app-profile-switch-arc" cx="25" cy="25" r="20" />
        </svg>
        <p className="app-profile-switch-label">Analiza wizytówki…</p>
        <ol className="wiz-analysis-steps">
          {STEPS.map((label, index) => {
            const done = index < stepIndex;
            const current = index === stepIndex;
            return (
              <li
                key={label}
                className={`wiz-analysis-step${done ? " is-done" : ""}${current ? " is-current" : ""}`}
              >
                <span className="wiz-analysis-step-mark" aria-hidden>
                  {done ? <Check /> : <span className="mono">{index + 1}</span>}
                </span>
                <span className="wiz-analysis-step-label">{label}</span>
              </li>
            );
          })}
        </ol>
      </div>
    </div>,
    document.body,
  );
}
