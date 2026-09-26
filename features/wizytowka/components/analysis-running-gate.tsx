"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AnalysisProgressOverlay } from "@/features/wizytowka/components/analysis-progress-overlay";

const POLL_MS = 2500;

/** Shows analysis overlay while audit run is `running` and polls until done. */
export function AnalysisRunningGate({ analyzing }: { analyzing: boolean }) {
  const router = useRouter();

  useEffect(() => {
    if (!analyzing) return;
    const id = window.setInterval(() => {
      router.refresh();
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [analyzing, router]);

  return <AnalysisProgressOverlay active={analyzing} />;
}
