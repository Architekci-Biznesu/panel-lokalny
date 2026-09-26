"use client";

import { useSyncExternalStore } from "react";
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

function subscribe() {
  return () => {};
}

function getTopbarSlot() {
  return document.getElementById("wiz-topbar-slot");
}

export function LastAnalysisLabel({ iso }: { iso: string | null }) {
  const slot = useSyncExternalStore(subscribe, getTopbarSlot, () => null);

  if (!slot) return null;

  return createPortal(
    <span className="wiz-last-analysis">
      Ostatnia analiza: {formatAnalyzedAt(iso)}
    </span>,
    slot,
  );
}
