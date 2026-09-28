"use client";

import { Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import type { ContentChannel } from "@/lib/db/schema";
import {
  getGenerationStatus,
  type GenerationStatus,
} from "@/features/publikacje/actions";
import { ContentApprovalCard } from "@/features/publikacje/components/content-approval-card";
import {
  ContentChat,
  type EditRequest,
} from "@/features/publikacje/components/content-chat";
import { GenerateProposalButton } from "@/features/publikacje/components/generate-proposal-button";
import {
  HistoryFilters,
  HistoryList,
} from "@/features/publikacje/components/history-list";
import type { HistoryStatusFilter } from "@/features/publikacje/content-status";
import { GENERATION_STARTED_EVENT } from "@/features/publikacje/generation-rules";
import type { HistoryItem } from "@/features/publikacje/load-history";
import type { InboxData } from "@/features/publikacje/load-inbox";

const POLL_MS = 3000;
const COLLAPSED_KEY = "pub-chat-collapsed";
const COLLAPSED_EVENT = "pub-chat-collapsed-change";

function readCollapsed(): boolean {
  try {
    return window.localStorage.getItem(COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

function writeCollapsed(value: boolean) {
  try {
    window.localStorage.setItem(COLLAPSED_KEY, value ? "1" : "0");
  } catch {
    // storage blocked - the chat simply is not remembered
  }
  window.dispatchEvent(new Event(COLLAPSED_EVENT));
}

function subscribeCollapsed(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(COLLAPSED_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(COLLAPSED_EVENT, onChange);
  };
}

function PostSkeleton({ label }: { label: string }) {
  return (
    <article className="ui-section pub-card pub-card-skeleton" aria-busy="true">
      <span className="ui-skel pub-card-skel-media" />
      <div className="ui-skel-stack">
        <p className="pub-card-skel-label">
          <Sparkles aria-hidden />
          {label}
        </p>
        <span className="ui-skel" style={{ width: "60%", height: "1.25rem" }} />
        <span
          className="ui-skel"
          style={{ width: "100%", height: "0.75rem" }}
        />
        <span className="ui-skel" style={{ width: "90%", height: "0.75rem" }} />
        <span className="ui-skel" style={{ width: "70%", height: "0.75rem" }} />
      </div>
    </article>
  );
}

/**
 * Publikacje: one list of posts (filters instead of tabs) with the AI chat
 * docked next to it. Tracks background generation runs and refreshes the
 * list as posts arrive.
 */
export function PostsWorkspace({
  inbox,
  history,
  status,
  channel,
  activeProfile,
  initialRuns,
}: {
  inbox: InboxData;
  history: HistoryItem[];
  status: HistoryStatusFilter;
  channel: ContentChannel | "all";
  activeProfile: { id: string; name: string };
  initialRuns: GenerationStatus[];
}) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRequest, setEditRequest] = useState<EditRequest | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [runs, setRuns] = useState(
    () => new Map(initialRuns.map((run) => [run.id, run])),
  );
  const collapsed = useSyncExternalStore(
    subscribeCollapsed,
    readCollapsed,
    () => false,
  );

  const editing = inbox.items.find((item) => item.id === editingId) ?? null;
  const running = [...runs.values()].filter((run) => run.status === "running");
  const runningKey = running.map((run) => run.id).join(",");

  function trackRun(runId: string, count: number) {
    setRuns((current) =>
      new Map(current).set(runId, {
        id: runId,
        status: "running",
        requested: count,
        created: 0,
        error: null,
      }),
    );
  }

  // Header "Wygeneruj kolejne" lives outside this component.
  useEffect(() => {
    function onStarted(event: Event) {
      const detail = (event as CustomEvent<{ runId: string; count: number }>)
        .detail;
      trackRun(detail.runId, detail.count);
    }
    window.addEventListener(GENERATION_STARTED_EVENT, onStarted);
    return () =>
      window.removeEventListener(GENERATION_STARTED_EVENT, onStarted);
  }, []);

  // Poll running batches; refresh the list whenever a post lands.
  useEffect(() => {
    if (!runningKey) return;
    const runIds = runningKey.split(",");
    const timer = setInterval(async () => {
      const result = await getGenerationStatus({ runIds });
      if (!result.ok) return;
      let changed = false;
      setRuns((current) => {
        const next = new Map(current);
        for (const run of result.runs) {
          const before = current.get(run.id);
          if (
            !before ||
            before.created !== run.created ||
            before.status !== run.status
          ) {
            changed = true;
          }
          next.set(run.id, run);
        }
        return next;
      });
      if (changed) router.refresh();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [runningKey, router]);

  const pendingSlots = running.reduce(
    (sum, run) => sum + Math.max(0, run.requested - run.created),
    0,
  );
  const showPending = status === "pending" || status === "all";
  const pendingItems = showPending ? inbox.items : [];
  const isEmpty =
    pendingSlots === 0 && pendingItems.length === 0 && history.length === 0;

  function edit(itemId: string) {
    setEditRequest(null);
    setEditingId(itemId);
    setMobileOpen(true);
    if (collapsed) writeCollapsed(false);
  }

  return (
    <div className={`pub-workspace${collapsed ? " is-chat-collapsed" : ""}`}>
      <div className="pub-workspace-list">
        <HistoryFilters status={status} channel={channel} />

        {Array.from({ length: pendingSlots }, (_, i) => (
          <PostSkeleton
            key={`skeleton-${i}`}
            label={i === 0 ? "AI pisze post…" : "W kolejce"}
          />
        ))}

        {pendingItems.map((item) => (
          <ContentApprovalCard
            key={item.id}
            item={item}
            channels={inbox.channels}
            groupName={inbox.groupName}
            groupSiblings={inbox.groupSiblings}
            activeProfile={activeProfile}
            isEditing={item.id === editingId}
            onEdit={() => edit(item.id)}
          />
        ))}

        {status !== "pending" && history.length ? (
          <section className="ui-section pub-history-section">
            <HistoryList items={history} />
          </section>
        ) : null}

        {isEmpty ? (
          <section className="ui-section pub-empty">
            <h2 className="pub-empty-title">
              {status === "pending"
                ? "Nic nie czeka na akceptację"
                : "Brak postów dla tych filtrów"}
            </h2>
            <p className="pub-empty-text">
              Poproś AI o nowe propozycje przyciskiem albo w czacie obok -
              uwzględni kontekst firmy i nie powtórzy ostatnich tematów.
            </p>
            <GenerateProposalButton variant="white" />
          </section>
        ) : null}
      </div>

      <ContentChat
        editing={editing}
        editRequest={editRequest}
        onEditRequest={(itemId, instruction) => {
          setEditRequest({ itemId, instruction, nonce: crypto.randomUUID() });
          setEditingId(itemId);
          document
            .getElementById(`pub-post-${itemId}`)
            ?.scrollIntoView({ behavior: "smooth", block: "center" });
        }}
        onExitEdit={() => {
          setEditRequest(null);
          setEditingId(null);
        }}
        runs={runs}
        onRunStarted={trackRun}
        collapsed={collapsed}
        onToggleCollapsed={() => writeCollapsed(!collapsed)}
        mobileOpen={mobileOpen}
        onMobileOpenChange={(open) => {
          setMobileOpen(open);
          if (open && collapsed) writeCollapsed(false);
        }}
      />
    </div>
  );
}
