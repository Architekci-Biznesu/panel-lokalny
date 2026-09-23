"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "gooey-toast";
import { requestNapInterest } from "@/features/wizytowka/actions";

export function NapView({ requestsCount }: { requestsCount: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div className="wiz-stack">
      <div className="wiz-tab-head">
        <div>
          <h2 className="text-base font-semibold">NAP i katalogi</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Spójne wpisy Name / Address / Phone w katalogach zewnętrznych
            realizuje zespół agencji. Tutaj widzisz status i możesz zgłosić
            zainteresowanie dodatkowymi wpisami.
          </p>
        </div>
      </div>

      <div className="wiz-tab-panel">
        <div className="wiz-nap-status">
          <span className="ui-pill ui-pill-neutral">Status</span>
          <p className="mt-2 text-sm">
            {requestsCount > 0
              ? `Zgłoszono zainteresowanie (${requestsCount}). Skontaktujemy się w sprawie realizacji.`
              : "Brak aktywnych zgłoszeń dodatkowych wpisów NAP."}
          </p>
        </div>

        <div className="wiz-tab-panel-actions">
          <button
            type="button"
            className="ui-btn ui-btn-primary ui-btn-sm"
            disabled={pending}
            onClick={() => {
              startTransition(async () => {
                const result = await requestNapInterest();
                if (!result.ok) {
                  toast.error({
                    title: "Nie udało się zgłosić",
                    description: result.error,
                  });
                  return;
                }
                toast.success({
                  title: "Zgłoszenie zapisane",
                  description:
                    "Dziękujemy - damy znać w sprawie dodatkowych wpisów NAP.",
                });
                router.refresh();
              });
            }}
          >
            {pending ? <Loader2 aria-hidden className="ui-btn-spinner" /> : null}
            Dokup dodatkowe wpisy NAP
          </button>
        </div>
      </div>
    </div>
  );
}
