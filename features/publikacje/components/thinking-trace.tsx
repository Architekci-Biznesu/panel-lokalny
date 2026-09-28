"use client";

/*
 * Adapted from Beautiful UI "Thinking" (https://www.beautifului.dev),
 * MIT License, Copyright (c) 2026 Shane Levine - see beautiful-ui.LICENSE.
 * Changes: driven by real request state instead of a scripted sequence,
 * Styl 4 tokens via .pub-think-* classes, Polish copy.
 */

import { useEffect, useState } from "react";
import { Check, Sparkles } from "lucide-react";

/**
 * Advances the visible step while the request runs; the last step waits for
 * the result. Callers mount the trace per request, so the step starts at 0.
 */
function useStepProgress(working: boolean, steps: number, stepMs: number) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (!working) return;
    const timer = setInterval(
      () => setStep((current) => Math.min(current + 1, steps - 1)),
      stepMs,
    );
    return () => clearInterval(timer);
  }, [working, steps, stepMs]);
  return working ? step : steps;
}

export function ThinkingTrace({
  working,
  steps,
  activeLabel = "AI pracuje",
  doneLabel = "Gotowe",
  stepMs = 1800,
}: {
  working: boolean;
  steps: string[];
  activeLabel?: string;
  doneLabel?: string;
  stepMs?: number;
}) {
  const current = useStepProgress(working, steps.length, stepMs);
  const visible = working ? steps.slice(0, current + 1) : steps;

  return (
    <div className="pub-think" role="status" aria-live="polite">
      <div className="pub-think-head">
        <Sparkles aria-hidden className={working ? "is-working" : undefined} />
        <span className={working ? "pub-think-shimmer" : "pub-think-done"}>
          {working ? activeLabel : doneLabel}
        </span>
      </div>
      <ol className="pub-think-steps">
        {visible.map((step, index) => {
          const running = working && index === current;
          return (
            <li key={step} className="pub-think-step">
              {running ? (
                <span className="pub-think-spinner" aria-hidden />
              ) : (
                <Check aria-hidden />
              )}
              <span>{step}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
