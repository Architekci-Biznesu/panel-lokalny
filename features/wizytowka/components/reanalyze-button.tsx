"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "gooey-toast";
import { AnalysisProgressOverlay } from "@/features/wizytowka/components/analysis-progress-overlay";
import { reanalyzeGbpAction } from "@/features/wizytowka/actions";

export function ReanalyzeButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <>
      <AnalysisProgressOverlay active={pending} />
      <button
        type="button"
        className="ui-btn ui-btn-primary"
        disabled={pending}
        onClick={() => {
          startTransition(async () => {
            const result = await reanalyzeGbpAction();
            if (!result.ok) {
              toast.error({
                title: "Analiza nie powiodła się",
                description: result.error,
              });
              return;
            }
            toast.success({
              title: "Analiza zakończona",
              description: "Sprawdź nowe propozycje.",
            });
            router.refresh();
          });
        }}
      >
        {pending ? (
          <Loader2 aria-hidden className="ui-btn-spinner" />
        ) : (
          <RefreshCw aria-hidden />
        )}
        Przeanalizuj ponownie
      </button>
    </>
  );
}
