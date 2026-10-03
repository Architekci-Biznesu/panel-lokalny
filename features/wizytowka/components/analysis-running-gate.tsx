"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/toast";
import { AnalysisProgressOverlay } from "@/features/wizytowka/components/analysis-progress-overlay";

const POLL_MS = 2500;

/**
 * Shows the analysis overlay while the latest audit run is `running` (the
 * worker does the work) and polls until it ends. When it ends on this screen,
 * says how it went.
 */
export function AnalysisRunningGate({
  analyzing,
  error,
}: {
  analyzing: boolean;
  /** Error of the latest run when it failed. */
  error: string | null;
}) {
  const router = useRouter();
  const wasAnalyzing = useRef(analyzing);

  useEffect(() => {
    if (!analyzing) return;
    const id = window.setInterval(() => {
      router.refresh();
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [analyzing, router]);

  useEffect(() => {
    if (wasAnalyzing.current && !analyzing) {
      if (error) {
        toast.error({ title: "Analiza nie powiodła się", description: error });
      } else {
        toast.success({
          title: "Analiza zakończona",
          description: "Sprawdź nowe propozycje.",
        });
      }
    }
    wasAnalyzing.current = analyzing;
  }, [analyzing, error]);

  return <AnalysisProgressOverlay active={analyzing} />;
}
