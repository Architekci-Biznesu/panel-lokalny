"use client";

import { Loader2, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "gooey-toast";
import { generateContentProposal } from "@/features/publikacje/actions";

/** "Wygeneruj propozycję" - AI picks a topic and writes a post into the inbox. */
export function GenerateProposalButton({
  label = "Wygeneruj propozycję",
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
          const result = await generateContentProposal({});
          if (!result.ok) {
            toast.error({
              title: "Nie udało się wygenerować",
              description: result.error,
            });
            return;
          }
          toast.success({ title: "Nowa propozycja czeka na akceptację" });
          router.push("/publikacje/inbox");
          router.refresh();
        })
      }
    >
      {pending ? (
        <Loader2 aria-hidden className="ui-btn-spinner" />
      ) : (
        <Sparkles aria-hidden />
      )}
      {pending ? "AI pisze post…" : label}
    </button>
  );
}
