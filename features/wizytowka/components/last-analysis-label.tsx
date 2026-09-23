"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

function formatAnalyzedAt(iso: string | null): string {
  if (!iso) return "jeszcze nie";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "jeszcze nie";
  return new Intl.DateTimeFormat("pl-PL", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function LastAnalysisLabel({ iso }: { iso: string | null }) {
  const [slot, setSlot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setSlot(document.getElementById("wiz-topbar-slot"));
  }, []);

  if (!slot) return null;

  return createPortal(
    <span className="wiz-last-analysis">
      Ostatnia analiza: {formatAnalyzedAt(iso)}
    </span>,
    slot,
  );
}
