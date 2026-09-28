"use client";

import { Sparkles } from "lucide-react";
import Link from "next/link";
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
import { ManualPostForm } from "@/features/publikacje/components/manual-post-form";
import {
  HistoryFilters,
  HistoryList,
} from "@/features/publikacje/components/history-list";
import type { HistoryStatusFilter } from "@/features/publikacje/content-status";
import { TopicPicker } from "@/features/publikacje/components/topic-picker";
import type { HistoryItem } from "@/features/publikacje/load-history";
import type { InboxData, TopicItem } from "@/features/publikacje/load-inbox";

const POLL_MS = 2000;
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
  newPostOpen,
  topics,
  topicsOpen,
}: {
  inbox: InboxData;
  history: HistoryItem[];
  status: HistoryStatusFilter;
  channel: ContentChannel | "all";
  activeProfile: { id: string; name: string };
  initialRuns: GenerationStatus[];
  /** "Nowy post" form open (?nowy=1) */
  newPostOpen: boolean;
  /** Topics waiting to be chosen */
  topics: TopicItem[];
  /** "Tematy postów" panel open (?tematy=1) */
  topicsOpen: boolean;
}) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRequest, setEditRequest] = useState<EditRequest | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  // Runs from the server (e.g. topics after onboarding) + ones started here;
  // the tracked state (polled) wins.
  const [tracked, setTracked] = useState<Map<string, GenerationStatus>>(
    () => new Map(),
  );
  const runs = new Map([
    ...initialRuns.map((run) => [run.id, run] as const),
    ...tracked,
  ]);
  const collapsed = useSyncExternalStore(
    subscribeCollapsed,
    readCollapsed,
    () => false,
  );

  const editing = inbox.items.find((item) => item.id === editingId) ?? null;
  const running = [...runs.values()].filter((run) => run.status === "running");
  const runningKey = running.map((run) => run.id).join(",");

  function trackRun(
    runId: string,
    count: number,
    kind: "posts" | "topics" = "posts",
  ) {
    setTracked((current) =>
      new Map(current).set(runId, {
        id: runId,
        kind,
        status: "running",
        requested: count,
        created: 0,
        error: null,
      }),
    );
  }

  /** Closes a panel opened through the URL (?nowy=1 / ?tematy=1), keeping filters. */
  function closePanel(nextStatus: HistoryStatusFilter = status) {
    const params = new URLSearchParams({ status: nextStatus });
    if (channel !== "all") params.set("kanal", channel);
    router.replace(`/publikacje?${params.toString()}`);
  }

  // Poll running batches; refresh the list as soon as a post or topic lands
  // (and once more when a batch finishes). Progress seen so far lives in the
  // effect - comparing inside a setState updater would run too late.
  useEffect(() => {
    if (!runningKey) return;
    const runIds = runningKey.split(",");
    const seen = new Map<string, string>();
    const timer = setInterval(async () => {
      const result = await getGenerationStatus({ runIds });
      if (!result.ok) return;
      let changed = false;
      for (const run of result.runs) {
        const progress = `${run.created}:${run.status}`;
        const before = seen.get(run.id) ?? "0:running";
        if (progress !== before) changed = true;
        seen.set(run.id, progress);
      }
      setTracked((current) => {
        const next = new Map(current);
        for (const run of result.runs) next.set(run.id, run);
        return next;
      });
      if (changed) router.refresh();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [runningKey, router]);

  const slots = (kind: "posts" | "topics") =>
    running
      .filter((run) => run.kind === kind)
      .reduce((sum, run) => sum + Math.max(0, run.requested - run.created), 0);
  const pendingSlots = slots("posts");
  const pendingTopics = slots("topics");
  const showPending = status === "pending" || status === "all";
  const pendingItems = showPending ? inbox.items : [];
  const isEmpty =
    !newPostOpen &&
    !topicsOpen &&
    pendingSlots === 0 &&
    pendingItems.length === 0 &&
    history.length === 0;

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

        {topicsOpen ? (
          <TopicPicker
            topics={topics}
            pendingTopics={pendingTopics}
            onRunStarted={trackRun}
            onClose={() => closePanel("pending")}
          />
        ) : topics.length || pendingTopics ? (
          <div className="pub-topics-banner" role="note">
            <p>
              {pendingTopics && !topics.length
                ? "AI przygotowuje tematy postów…"
                : `Masz ${topics.length} ${topics.length === 1 ? "temat" : topics.length < 5 ? "tematy" : "tematów"} do wyboru - AI napisze posty z tych, które zaznaczysz.`}
            </p>
            <Link
              href="/publikacje?tematy=1"
              className="ui-btn ui-btn-primary ui-btn-sm"
            >
              Wybierz tematy
            </Link>
          </div>
        ) : null}

        {newPostOpen ? <ManualPostForm onClose={() => closePanel()} /> : null}

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
              Wybierz tematy, z których AI napisze posty, albo poproś o nie w
              czacie obok. Możesz też dodać własny post.
            </p>
            <Link href="/publikacje?tematy=1" className="ui-btn ui-btn-white">
              <Sparkles aria-hidden />
              Wybierz tematy
            </Link>
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
        onRunStarted={(runId, count) => trackRun(runId, count)}
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
