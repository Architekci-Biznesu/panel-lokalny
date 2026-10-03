"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { KONTEKST_FIELDS } from "@/features/ustawienia/kontekst-fields";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { toast } from "@/lib/toast";
import { saveKontekstAction } from "@/features/ustawienia/kontekst-actions";
import { AnalysisProgressOverlay } from "@/features/wizytowka/components/analysis-progress-overlay";
import { reanalyzeGbpAction } from "@/features/wizytowka/actions";

const schema = z.object({
  services: z.string().trim().min(1, "Podaj usługi").max(4000),
  tone: z.string().trim().min(1, "Podaj ton").max(2000),
  targetAudience: z.string().trim().min(1, "Podaj grupę docelową").max(2000),
  differentiators: z.string().trim().max(2000),
  serviceArea: z.string().trim().max(2000),
  avoid: z.string().trim().max(4000),
  outOfScope: z.string().trim().max(2000),
  websiteUrl: z.string().trim().max(500),
  notes: z.string().trim().max(4000),
});

type FormValues = z.infer<typeof schema>;

const HINTS: Record<keyof FormValues, string> = {
  services: "Lista usług, które naprawdę oferujesz - bazą dla propozycji AI.",
  tone: "Jak ma brzmieć komunikacja (np. ekspercko, ciepło, konkretnie).",
  targetAudience: "Dla kogo jest ta firma - kto kupuje najczęściej.",
  differentiators:
    "Konkretne wyróżniki (lata na rynku, specjalizacja, dojazd).",
  serviceArea:
    "Miasta i dzielnice działania - nie tylko adres z wizytówki Google.",
  avoid:
    "Najważniejsze pole: czego AI ma unikać. Uzupełnia się też przy odrzucaniu propozycji.",
  outOfScope: "Usługi, których nie robicie - żeby AI ich nie proponowało.",
  websiteUrl: "Adres strony WWW używany jako kontekst.",
  notes: "Dowolne uwagi własne dla AI i zespołu.",
};

export function KontekstForm({
  initial,
  hasGbp,
}: {
  initial: FormValues;
  hasGbp: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [analyzing, setAnalyzing] = useState(false);
  const [reauditPrompt, setReauditPrompt] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: initial,
  });

  return (
    <div className="wiz-stack">
      <AnalysisProgressOverlay active={analyzing} />
      <form
        className="kontekst-form"
        noValidate
        onSubmit={handleSubmit((values) => {
          startTransition(async () => {
            if (values.websiteUrl && !/^https?:\/\//i.test(values.websiteUrl)) {
              toast.error({
                title: "Niepoprawny adres strony",
                description: "Użyj http:// lub https://",
              });
              return;
            }
            const result = await saveKontekstAction(values);
            if (!result.ok) {
              toast.error({
                title: "Nie udało się zapisać",
                description: result.error,
              });
              return;
            }
            toast.success({ title: "Kontekst firmy zapisany" });
            if (result.suggestReaudit && hasGbp) {
              setReauditPrompt(true);
            }
            router.refresh();
          });
        })}
      >
        {KONTEKST_FIELDS.map(([name, label, kind]) => (
          <div key={name} className="kontekst-field">
            <label className="text-sm font-medium" htmlFor={name}>
              {label}
              {[
                "serviceArea",
                "avoid",
                "outOfScope",
                "websiteUrl",
                "notes",
              ].includes(name) ? (
                <span className="text-muted-foreground font-normal">
                  {" "}
                  (opcjonalne)
                </span>
              ) : null}
            </label>
            <p className="locked-note mt-1">{HINTS[name]}</p>
            {kind === "input" ? (
              <input id={name} className="ui-field mt-2" {...register(name)} />
            ) : (
              <textarea
                id={name}
                className="ui-textarea mt-2"
                rows={name === "avoid" || name === "services" ? 4 : 3}
                {...register(name)}
              />
            )}
            {errors[name]?.message ? (
              <p className="text-sm text-destructive mt-1">
                {errors[name]?.message}
              </p>
            ) : null}
          </div>
        ))}

        <button
          type="submit"
          className="ui-btn ui-btn-primary"
          disabled={pending}
        >
          {pending ? <Loader2 aria-hidden className="ui-btn-spinner" /> : null}
          Zapisz kontekst
        </button>
      </form>

      {reauditPrompt ? (
        <div className="banner">
          <p className="text-sm font-medium">
            Kontekst się zmienił - uruchomić ponowną analizę wizytówki?
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className="ui-btn ui-btn-primary ui-btn-sm"
              disabled={pending}
              onClick={() => {
                startTransition(async () => {
                  setAnalyzing(true);
                  try {
                    const result = await reanalyzeGbpAction();
                    if (!result.ok) {
                      toast.error({
                        title: "Analiza nie powiodła się",
                        description: result.error,
                      });
                      return;
                    }
                    // Analysis runs in the worker - Wizytówka shows its
                    // progress and the result.
                    setReauditPrompt(false);
                    router.push("/wizytowka/informacje");
                  } finally {
                    setAnalyzing(false);
                  }
                });
              }}
            >
              Przeanalizuj ponownie
            </button>
            <button
              type="button"
              className="ui-btn ui-btn-ghost ui-btn-sm"
              onClick={() => setReauditPrompt(false)}
            >
              Później
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
