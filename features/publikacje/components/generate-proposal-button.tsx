"use client";

import { Loader2, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "gooey-toast";
import { generateMoreProposals } from "@/features/publikacje/actions";
import {
  GENERATION_STARTED_EVENT,
  MORE_POSTS,
} from "@/features/publikacje/generation-rules";

/** "Wygeneruj kolejne" - AI writes 3 more proposals in the background. */
export function GenerateProposalButton({
  label = "Wygeneruj kolejne",
  variant = "primary",
}: {
  label?: string;
  variant?: "primary" | "white";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      className={`ui-btn ui-btn-${variant}`}
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await generateMoreProposals();
          if (!result.ok) {
            toast.error({
              title: "Nie udało się zacząć",
              description: result.error,
            });
            return;
          }
          toast.info({
            title: "AI pisze kolejne propozycje",
            description: "Pojawią się na liście za chwilę.",
          });
          window.dispatchEvent(
            new CustomEvent(GENERATION_STARTED_EVENT, {
              detail: { runId: result.runId, count: MORE_POSTS },
            }),
          );
          router.push("/publikacje?status=pending");
        })
      }
    >
      {pending ? (
        <Loader2 aria-hidden className="ui-btn-spinner" />
      ) : (
        <Sparkles aria-hidden />
      )}
      {label}
    </button>
  );
}
