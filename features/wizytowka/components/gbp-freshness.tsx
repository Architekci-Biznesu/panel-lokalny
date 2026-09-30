"use client";

import {
  useEffect,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "@/lib/toast";
import {
  getGbpDataStatusAction,
  refreshGbpDataAction,
} from "@/features/wizytowka/snapshots/actions";
import { useWizEditing } from "@/features/wizytowka/components/wiz-editing";

type Scope = "wizytowka" | "pulpit";

const POLL_MS = 2500;
const CLOCK_MS = 30_000;
/** Older than a day: the dot turns orange - a hint to refresh. */
const STALE_MS = 24 * 60 * 60 * 1000;

// Relative time is computed only in the browser (no hydration mismatch) and
// ticks every 30 s.
function subscribeClock(onTick: () => void) {
  const timer = setInterval(onTick, CLOCK_MS);
  return () => clearInterval(timer);
}
const clockNow = () => Math.floor(Date.now() / CLOCK_MS) * CLOCK_MS;
const serverClock = () => null;

const RELATIVE = new Intl.RelativeTimeFormat("pl", {
  numeric: "auto",
  style: "short",
});

function relativeLabel(iso: string, now: number): string {
  const diffSec = Math.max(0, (now - new Date(iso).getTime()) / 1000);
  if (diffSec < 60) return "przed chwilą";
  const minutes = Math.round(diffSec / 60);
  if (minutes < 60) return RELATIVE.format(-minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (hours < 24) return RELATIVE.format(-hours, "hour");
  return RELATIVE.format(-Math.round(hours / 24), "day");
}

/**
 * "● Google · 4 min temu ↻" - age of Google data with a manual refresh. While a background
 * refresh runs it polls a light status action and, when it ends, reloads the
 * screen - unless the customer is editing; then it only says newer data waits.
 */
export function GbpFreshness(props: {
  scope: Scope;
  fetchedAtIso: string | null;
  refreshing: boolean;
}) {
  // New server data (after router.refresh) resets the local state.
  return (
    <FreshnessLine
      key={`${props.fetchedAtIso}|${props.refreshing}`}
      {...props}
    />
  );
}

function FreshnessLine({
  scope,
  fetchedAtIso,
  refreshing,
}: {
  scope: Scope;
  fetchedAtIso: string | null;
  refreshing: boolean;
}) {
  const router = useRouter();
  const editing = useWizEditing();
  const now = useSyncExternalStore(subscribeClock, clockNow, serverClock);
  const [polling, setPolling] = useState(refreshing);
  const [newerWaiting, setNewerWaiting] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!polling) return;
    let cancelled = false;
    const timer = setInterval(() => {
      void (async () => {
        const status = await getGbpDataStatusAction({ scope });
        if (cancelled || !status.ok || status.refreshing) return;
        setPolling(false);
        if (status.fetchedAt !== fetchedAtIso) setNewerWaiting(true);
      })();
    }, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [polling, scope, fetchedAtIso]);

  // Newer data arrived - show it once nothing is being edited.
  useEffect(() => {
    if (newerWaiting && !editing) router.refresh();
  }, [newerWaiting, editing, router]);

  function onRefresh() {
    startTransition(async () => {
      const result = await refreshGbpDataAction({ scope });
      if (!result.ok) {
        toast.error({ title: "Nie odświeżono", description: result.error });
        return;
      }
      setPolling(true);
    });
  }

  const busy = polling || pending;
  const stale =
    fetchedAtIso != null &&
    now != null &&
    now - new Date(fetchedAtIso).getTime() > STALE_MS;
  const age =
    fetchedAtIso && now != null
      ? relativeLabel(fetchedAtIso, now)
      : fetchedAtIso
        ? "…"
        : "brak danych";

  return (
    <div
      className={`ui-freshness${busy ? " is-busy" : stale ? " is-stale" : ""}`}
      aria-live="polite"
    >
      <span className="ui-freshness-dot" aria-hidden />
      {busy ? (
        <span>Pobieram dane z Google…</span>
      ) : (
        <span>
          Google · <span className="mono">{age}</span>
          <span className="sr-only"> - wiek danych z Google</span>
        </span>
      )}
      {newerWaiting && editing ? (
        <span className="ui-freshness-note">· nowsze dane po zapisaniu</span>
      ) : (
        <button
          type="button"
          className="ui-freshness-refresh"
          disabled={busy}
          onClick={onRefresh}
          aria-label="Odśwież z Google"
          data-tip="Odśwież z Google"
        >
          {busy ? (
            <Loader2 aria-hidden className="ui-freshness-spin" />
          ) : (
            <RefreshCw aria-hidden />
          )}
        </button>
      )}
    </div>
  );
}

/** Same line while the real one waits for its data - keeps the page from jumping. */
export function GbpFreshnessPlaceholder() {
  return (
    <div className="ui-freshness is-placeholder" aria-hidden>
      <span className="ui-freshness-dot" />
      <span>
        Google · <span className="mono">…</span>
      </span>
      <button type="button" className="ui-freshness-refresh" disabled>
        <RefreshCw aria-hidden />
      </button>
    </div>
  );
}
