"use client";

import { Loader2, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "gooey-toast";
import { generateContentProposal } from "@/features/publikacje/actions";
import { ThinkingTrace } from "@/features/publikacje/components/thinking-trace";

const EXAMPLES = [
  "Nowa usługa, którą wprowadzamy od przyszłego miesiąca",
  "Jak przygotować się do pierwszej wizyty",
  "Czym różnimy się od konkurencji",
];

const STEPS = [
  "Czytam kontekst firmy",
  "Układam temat",
  "Piszę post pod wizytówkę Google",
];

/** Manual request: the customer says what to write about, AI writes the post. */
export function NewContentForm() {
  const router = useRouter();
  const [request, setRequest] = useState("");
  const [pending, startTransition] = useTransition();

  function submit() {
    const text = request.trim();
    if (text.length < 3) {
      toast.error({ title: "Napisz, o czym ma być publikacja" });
      return;
    }
    startTransition(async () => {
      const result = await generateContentProposal({ request: text });
      if (!result.ok) {
        toast.error({
          title: "Nie udało się przygotować posta",
          description: result.error,
        });
        return;
      }
      toast.success({ title: "Propozycja czeka na akceptację" });
      router.push("/publikacje/inbox");
      router.refresh();
    });
  }

  return (
    <section className="ui-section pub-new">
      <form
        className="pub-new-form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <label className="pub-new-label" htmlFor="pub-new-request">
          O czym ma być publikacja?
        </label>
        <textarea
          id="pub-new-request"
          className="ui-textarea"
          rows={4}
          maxLength={500}
          placeholder="Np. zapraszamy na przegląd klimatyzacji przed latem"
          value={request}
          disabled={pending}
          onChange={(event) => setRequest(event.target.value)}
        />
        <div className="pub-new-examples">
          {EXAMPLES.map((example) => (
            <button
              key={example}
              type="button"
              className="pub-chat-chip"
              disabled={pending}
              onClick={() => setRequest(example)}
            >
              {example}
            </button>
          ))}
        </div>
        <p className="pub-new-hint">
          AI uwzględni kontekst firmy i to, czego mamy unikać. Gotowa propozycja
          trafi do zakładki Do akceptacji.
        </p>
        <div className="pub-new-actions">
          <button
            type="submit"
            className="ui-btn ui-btn-primary"
            disabled={pending}
          >
            {pending ? (
              <Loader2 aria-hidden className="ui-btn-spinner" />
            ) : (
              <Sparkles aria-hidden />
            )}
            Przygotuj propozycję
          </button>
        </div>
      </form>
      {pending ? (
        <ThinkingTrace working steps={STEPS} activeLabel="AI pisze post" />
      ) : null}
    </section>
  );
}
