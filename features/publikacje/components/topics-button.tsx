"use client";

import { Loader2, Sparkles } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useTransition } from "react";
import { toast } from "gooey-toast";
import { suggestTopics } from "@/features/publikacje/actions";

type TopicsState = {
  /** Topics waiting to be chosen */
  open: number;
  /** AI is writing topics right now */
  generating: boolean;
};

const TopicsStateContext = createContext<TopicsState>({
  open: 0,
  generating: false,
});

/** Topic state from the layout, so every "topics" button agrees with it. */
export function TopicsStateProvider({
  open,
  generating,
  children,
}: TopicsState & { children: React.ReactNode }) {
  return (
    <TopicsStateContext value={{ open, generating }}>
      {children}
    </TopicsStateContext>
  );
}

/**
 * Topics entry point: while there are topics it opens the picker; once they
 * run out it becomes "Generuj tematy" and asks AI for a new batch directly
 * (the picker itself never generates on open).
 */
export function TopicsButton({
  className,
  pickLabel = "Wybierz tematy",
  generateLabel = "Generuj tematy",
}: {
  className: string;
  /** Label while topics wait to be chosen */
  pickLabel?: string;
  /** Label when there are none left */
  generateLabel?: string;
}) {
  const { open, generating } = useContext(TopicsStateContext);
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  if (open > 0) {
    return (
      <Link href="/publikacje?tematy=1" className={className}>
        <Sparkles aria-hidden />
        {pickLabel}
      </Link>
    );
  }

  const busy = pending || generating;

  return (
    <button
      type="button"
      className={className}
      disabled={busy}
      onClick={() =>
        startTransition(async () => {
          const result = await suggestTopics();
          if (!result.ok) {
            toast.error({
              title: "AI nie zaproponowało tematów",
              description: result.error,
            });
            return;
          }
          // The running batch is picked up (and polled) by the posts list.
          if (pathname === "/publikacje") router.refresh();
          else router.push("/publikacje?status=pending");
        })
      }
    >
      {busy ? (
        <Loader2 aria-hidden className="ui-btn-spinner" />
      ) : (
        <Sparkles aria-hidden />
      )}
      {busy ? "AI generuje tematy…" : generateLabel}
    </button>
  );
}
