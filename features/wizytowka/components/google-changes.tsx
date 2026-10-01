"use client";

import { createContext, useContext, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Hourglass, Loader2, RefreshCcw } from "lucide-react";
import { toast } from "@/lib/toast";
import { resolveGoogleChange } from "@/features/wizytowka/actions";
import type {
  GoogleField,
  GoogleFieldChange,
} from "@/features/wizytowka/google-updates";

type GoogleChanges = {
  changes: GoogleFieldChange[];
  mapsUri: string | null;
};

const GoogleChangesContext = createContext<GoogleChanges>({
  changes: [],
  mapsUri: null,
});

/** Google's changes and pending reviews of the active listing (from the layout). */
export function GoogleChangesProvider({
  changes,
  mapsUri,
  children,
}: GoogleChanges & { children: React.ReactNode }) {
  return (
    <GoogleChangesContext.Provider value={{ changes, mapsUri }}>
      {children}
    </GoogleChangesContext.Provider>
  );
}

/**
 * Under a field: "Google changed it - customers see X" with the choice to
 * take Google's version or keep the own one, or "waits for Google's review".
 * Renders nothing when Google shows the owner's version.
 */
export function GoogleFieldNote({ field }: { field: GoogleField }) {
  const { changes, mapsUri } = useContext(GoogleChangesContext);
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const change = changes.find((c) => c.field === field);
  if (!change) return null;

  function resolve(choice: "google" | "own") {
    startTransition(async () => {
      const result = await resolveGoogleChange({ field, choice });
      if (!result.ok) {
        toast.error({ title: "Nie zapisano", description: result.error });
        router.refresh();
        return;
      }
      toast.success({
        title:
          choice === "google"
            ? "Przyjęto wersję Google"
            : "Wysłano Twoją wersję do Google",
        description:
          choice === "own"
            ? "Google może ją jeszcze sprawdzić albo zmienić ponownie."
            : undefined,
      });
      router.refresh();
    });
  }

  const value = change.customerValue ? (
    <span className="wiz-gnote-value">„{change.customerValue}”</span>
  ) : null;
  const googleLink = mapsUri ? (
    <a
      href={mapsUri}
      target="_blank"
      rel="noopener noreferrer"
      className="wiz-gnote-link"
    >
      Zobacz w Google
      <ArrowUpRight aria-hidden />
    </a>
  ) : null;

  if (change.kind === "pending") {
    return (
      <div className="wiz-gnote is-pending" role="status">
        <Hourglass aria-hidden className="wiz-gnote-icon" />
        <div className="wiz-gnote-copy">
          <p className="wiz-gnote-title">
            Czeka na sprawdzenie przez Google - zwykle kilka minut
          </p>
          <p className="wiz-gnote-text">
            {value ? <>Do tego czasu klienci widzą: {value}</> : null}{" "}
            {googleLink}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="wiz-gnote is-google" role="status">
      <RefreshCcw aria-hidden className="wiz-gnote-icon" />
      <div className="wiz-gnote-copy">
        <p className="wiz-gnote-title">Google zmienił to pole</p>
        <p className="wiz-gnote-text">
          {value ? <>Klienci widzą: {value}</> : "Klienci widzą wersję Google."}{" "}
          {googleLink}
        </p>
        <div className="wiz-gnote-actions">
          <button
            type="button"
            className="ui-btn ui-btn-white ui-btn-sm"
            disabled={pending}
            onClick={() => resolve("google")}
          >
            {pending ? (
              <Loader2 aria-hidden className="ui-btn-spinner" />
            ) : null}
            Przyjmij wersję Google
          </button>
          <button
            type="button"
            className="ui-btn ui-btn-ghost ui-btn-sm"
            disabled={pending}
            onClick={() => resolve("own")}
          >
            Zostaw moją
          </button>
        </div>
      </div>
    </div>
  );
}
