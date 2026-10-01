"use client";

import { createContext, useContext, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, History, Loader2 } from "lucide-react";
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

/** Google's change or pending review of one field (null when none). */
export function useGoogleFieldChange(field?: GoogleField) {
  const { changes, mapsUri } = useContext(GoogleChangesContext);
  const change = field
    ? (changes.find((c) => c.field === field) ?? null)
    : null;
  return { change, mapsUri };
}

/** Take Google's version of a field or send the owner's one again. */
function useResolveGoogleChange(field: GoogleField) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

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
            ? "Zostawiono wersję Google"
            : "Wysłano Twoją wersję do Google",
        description:
          choice === "own"
            ? "Google może ją jeszcze sprawdzić albo zmienić ponownie."
            : undefined,
      });
      router.refresh();
    });
  }

  return { pending, resolve };
}

function GoogleLink({ mapsUri }: { mapsUri: string | null }) {
  if (!mapsUri) return null;
  return (
    <a
      href={mapsUri}
      target="_blank"
      rel="noopener noreferrer"
      className="wiz-glink"
    >
      Zobacz w Google
      <ArrowUpRight aria-hidden />
    </a>
  );
}

/** "Zostaw wersję Google" - the same button wherever Google changed a field. */
function KeepGoogleButton({ field }: { field: GoogleField }) {
  const { pending, resolve } = useResolveGoogleChange(field);
  return (
    <button
      type="button"
      className="ui-btn ui-btn-outline ui-btn-sm"
      disabled={pending}
      onClick={() => resolve("google")}
    >
      {pending ? <Loader2 aria-hidden className="ui-btn-spinner" /> : null}
      Zostaw wersję Google
    </button>
  );
}

/**
 * A field's value with Google's change in mind: when Google changed the field,
 * the owner's version and what customers see side by side with the choice;
 * otherwise the value and, if any, the "waits for Google" line.
 */
export function GoogleFieldBody({
  field,
  children,
}: {
  field?: GoogleField;
  children: React.ReactNode;
}) {
  const { change } = useGoogleFieldChange(field);
  if (!field || !change) return <>{children}</>;
  if (change.kind === "google")
    return <GoogleFieldNote field={field} own={children} />;
  return (
    <>
      {children}
      <GoogleFieldNote field={field} />
    </>
  );
}

/**
 * Under a field: Google changed it (what customers see, with the choice to
 * keep Google's version or send the own one again) or the owner's edit waits
 * for Google's review. Renders nothing when Google shows the owner's version.
 */
export function GoogleFieldNote({
  field,
  own,
  pendingOnly = false,
}: {
  field: GoogleField;
  /** The owner's version, shown next to Google's. */
  own?: React.ReactNode;
  /** Only the "waits for Google" line (Google's change is shown elsewhere). */
  pendingOnly?: boolean;
}) {
  const { change, mapsUri } = useGoogleFieldChange(field);
  const { pending, resolve } = useResolveGoogleChange(field);
  if (!change) return null;

  if (change.kind === "pending") {
    return (
      <div className="wiz-gwait" role="status">
        <span className="wiz-gdot is-pending" aria-hidden />
        <p className="wiz-gwait-text">
          Czeka na sprawdzenie przez Google
          <span> · zwykle kilka minut</span>
          {change.customerValue ? (
            <span className="wiz-gwait-value">
              Do tego czasu klienci widzą: „{change.customerValue}”
            </span>
          ) : null}
        </p>
        <GoogleLink mapsUri={mapsUri} />
      </div>
    );
  }
  if (pendingOnly) return null;

  return (
    <div className="wiz-gchange" role="status">
      <span className="wiz-gtag">
        <span className="wiz-gdot" aria-hidden />
        Google zmienił to pole
      </span>
      <div className="wiz-gchange-panel">
        <div className={own ? "ui-compare-cols" : undefined}>
          {own ? (
            <div className="ui-compare-col">
              <div className="ui-compare-col-head">
                <span>Twoja wersja</span>
              </div>
              <div className="wiz-gchange-own">{own}</div>
            </div>
          ) : null}
          <div
            className={`ui-compare-col wiz-gchange-google${own ? " ui-compare-col-next" : ""}`}
          >
            <div className="ui-compare-col-head">
              <span>Widzą klienci</span>
              <GoogleLink mapsUri={mapsUri} />
            </div>
            <p className="wiz-gchange-value">
              {change.customerValue ?? "Wersja Google"}
            </p>
          </div>
        </div>
      </div>
      <div className="wiz-gchange-actions">
        <button
          type="button"
          className="ui-btn ui-btn-outline ui-btn-sm"
          disabled={pending}
          onClick={() => resolve("own")}
        >
          Zostaw moją
        </button>
        <button
          type="button"
          className="ui-btn ui-btn-outline ui-btn-sm"
          disabled={pending}
          onClick={() => resolve("google")}
        >
          {pending ? <Loader2 aria-hidden className="ui-btn-spinner" /> : null}
          Zostaw wersję Google
        </button>
      </div>
    </div>
  );
}

/** Next to "Propozycja AI": the field is also changed by Google. */
export function GoogleChangedTag({ field }: { field?: GoogleField }) {
  const { change } = useGoogleFieldChange(field);
  if (change?.kind !== "google") return null;
  return (
    <span className="wiz-gtag">
      <span className="wiz-gdot" aria-hidden />
      Google zmienił
    </span>
  );
}

/** Top of an AI proposal panel: Google changed the field on its own. */
export function GoogleProposalStrip({ field }: { field?: GoogleField }) {
  const { change, mapsUri } = useGoogleFieldChange(field);
  if (!field || change?.kind !== "google") return null;
  return (
    <div className="wiz-gstrip" role="status">
      <span className="wiz-gdot" aria-hidden />
      <p className="wiz-gstrip-text">
        {change.customerValue ? (
          <>
            Google sam zmienił to pole na „{change.customerValue}” - tak widzą
            je teraz klienci.
          </>
        ) : (
          "Google sam zmienił to pole - klienci widzą wersję Google."
        )}
      </p>
      <GoogleLink mapsUri={mapsUri} />
      <KeepGoogleButton field={field} />
    </div>
  );
}

/**
 * "Obecnie" of an AI proposal when Google changed the field: what customers
 * see now, and the owner's version under it.
 */
export function GoogleCurrentValue({
  field,
  own,
}: {
  field?: GoogleField;
  own: React.ReactNode;
}) {
  const { change } = useGoogleFieldChange(field);
  if (change?.kind !== "google" || !change.customerValue) return <>{own}</>;
  return (
    <div className="wiz-gcurrent">
      <p className="wiz-gcurrent-value">
        {change.customerValue}
        <span className="wiz-gcurrent-chip">wersja Google</span>
      </p>
      <div className="wiz-gcurrent-own">
        <span className="wiz-gcurrent-label">
          <History aria-hidden />
          Twoja wersja
        </span>
        {own}
      </div>
    </div>
  );
}
