"use client";

import {
  useEffect,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { toast } from "gooey-toast";
import {
  getGbpDataStatusAction,
  refreshGbpDataAction,
} from "@/features/wizytowka/snapshots/actions";
import { useWizEditing } from "@/features/wizytowka/components/wiz-editing";

type Scope = "wizytowka" | "pulpit";

const POLL_MS = 2500;
const CLOCK_MS = 30_000;

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
 * "Dane z Google: 4 min temu" with a manual refresh. While a background
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

  return (
    <div className="ui-freshness" aria-live="polite">
      {busy ? <span className="ui-freshness-dot" aria-hidden /> : null}
      <span>
        Dane z Google:{" "}
        <span className="mono">
          {fetchedAtIso && now != null
            ? relativeLabel(fetchedAtIso, now)
            : fetchedAtIso
              ? "…"
              : "-"}
        </span>
        {busy ? " · odświeżanie…" : null}
      </span>
      {newerWaiting && editing ? (
        <span className="ui-freshness-note">
          W Google są nowsze dane - odśwież po zapisaniu
        </span>
      ) : (
        <button
          type="button"
          className="ui-freshness-refresh"
          disabled={busy}
          onClick={onRefresh}
        >
          <RefreshCw aria-hidden />
          Odśwież z Google
        </button>
      )}
    </div>
  );
}
