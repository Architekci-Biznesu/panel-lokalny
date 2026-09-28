"use client";

/*
 * Adapted from Beautiful UI "Thinking" (https://www.beautifului.dev),
 * MIT License, Copyright (c) 2026 Shane Levine - see beautiful-ui.LICENSE.
 * Changes: shown only while a real request runs (callers unmount it when the
 * result arrives), Styl 4 tokens via .pub-think-* classes, Polish copy.
 */

import { useEffect, useState } from "react";
import { Check, Sparkles } from "lucide-react";

/**
 * "AI pracuje" trace: steps appear one by one; the last one keeps spinning
 * until the caller unmounts the trace. Mounted per request, so it starts at 0.
 */
export function ThinkingTrace({
  steps,
  activeLabel = "AI pracuje",
  stepMs = 1800,
}: {
  steps: string[];
  activeLabel?: string;
  stepMs?: number;
}) {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const timer = setInterval(
      () => setCurrent((step) => Math.min(step + 1, steps.length - 1)),
      stepMs,
    );
    return () => clearInterval(timer);
  }, [steps.length, stepMs]);

  return (
    <div className="pub-think" role="status" aria-live="polite">
      <div className="pub-think-head">
        <Sparkles aria-hidden />
        <span className="pub-think-shimmer">{activeLabel}</span>
      </div>
      <ol className="pub-think-steps">
        {steps.slice(0, current + 1).map((step, index) => (
          <li key={step} className="pub-think-step">
            {index === current ? (
              <span className="pub-think-spinner" aria-hidden />
            ) : (
              <Check aria-hidden />
            )}
            <span>{step}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
