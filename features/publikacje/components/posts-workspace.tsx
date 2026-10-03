"use client";

import { Check, Inbox, Sparkles, SquarePen } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import type { ContentChannel } from "@/lib/db/schema";
import { toast } from "@/lib/toast";
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
import { TopicsButton } from "@/features/publikacje/components/topics-button";
import type { HistoryItem } from "@/features/publikacje/load-history";
import type { InboxData, TopicItem } from "@/features/publikacje/load-inbox";

const POLL_MS = 2000;

/** Collapsed/expanded flag remembered in localStorage (chat, topics list). */
function storedFlag(key: string) {
  const event = `${key}-change`;
  return {
    read(): boolean {
      try {
        return window.localStorage.getItem(key) === "1";
      } catch {
        return false;
      }
    },
    write(value: boolean) {
      try {
        window.localStorage.setItem(key, value ? "1" : "0");
      } catch {
        // storage blocked - the state simply is not remembered
      }
      window.dispatchEvent(new Event(event));
    },
    subscribe(onChange: () => void) {
      window.addEventListener("storage", onChange);
      window.addEventListener(event, onChange);
      return () => {
        window.removeEventListener("storage", onChange);
        window.removeEventListener(event, onChange);
      };
    },
  };
}

const chatFlag = storedFlag("pub-chat-collapsed");
const topicsFlag = storedFlag("pub-topics-collapsed");

function PostSkeleton({ label, sub }: { label: string; sub?: string }) {
  return (
    <article className="pub-card pub-card-skeleton" aria-busy="true">
      <span className="ui-skel pub-card-skel-media" />
      <div className="pub-card-skel-body">
        <p className="pub-card-skel-label">
          <span className="pub-card-skel-icon" aria-hidden>
            <Sparkles />
          </span>
          <span className="pub-shimmer">{label}</span>
          {sub ? <span className="pub-card-skel-sub">{sub}</span> : null}
        </p>
        <span
          className="ui-skel"
          style={{ width: "58%", height: "1.125rem" }}
        />
        <span
          className="ui-skel"
          style={{ width: "100%", height: "0.75rem" }}
        />
        <span className="ui-skel" style={{ width: "92%", height: "0.75rem" }} />
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
    chatFlag.subscribe,
    chatFlag.read,
    () => false,
  );
  const topicsCollapsed = useSyncExternalStore(
    topicsFlag.subscribe,
    topicsFlag.read,
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

  // ?tematy=1 (links from other places) is a one-shot "show the topics":
  // expand the list and drop the parameter from the address.
  useEffect(() => {
    if (!topicsOpen) return;
    topicsFlag.write(false);
    const params = new URLSearchParams({ status });
    if (channel !== "all") params.set("kanal", channel);
    router.replace(`/publikacje?${params.toString()}`);
  }, [topicsOpen, status, channel, router]);

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
        // Failed (also cut off by a worker restart) - say so, polling stops.
        if (run.status === "failed" && !before.endsWith(":failed")) {
          toast.error({
            title:
              run.kind === "topics"
                ? "Nie udało się przygotować tematów"
                : "Nie udało się przygotować postów",
            description: run.error ?? undefined,
          });
        }
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
    if (collapsed) chatFlag.write(false);
  }

  function exitEdit() {
    setEditRequest(null);
    setEditingId(null);
  }

  return (
    <div className={`pub-workspace${collapsed ? " is-chat-collapsed" : ""}`}>
      <div className="pub-workspace-list">
        <HistoryFilters
          status={status}
          channel={channel}
          pendingCount={inbox.items.length}
        />

        {topicsOpen || topics.length || pendingTopics ? (
          <TopicPicker
            topics={topics}
            pendingTopics={pendingTopics}
            collapsed={topicsCollapsed && !topicsOpen}
            onToggleCollapsed={() => topicsFlag.write(!topicsCollapsed)}
            onRunStarted={trackRun}
          />
        ) : null}

        {newPostOpen ? <ManualPostForm onClose={() => closePanel()} /> : null}

        {Array.from({ length: pendingSlots }, (_, i) => (
          <PostSkeleton
            key={`skeleton-${i}`}
            label={i === 0 ? "AI pisze post…" : "W kolejce"}
            sub={
              i === 0
                ? "Czytam kontekst firmy · wybieram temat, którego jeszcze nie było"
                : undefined
            }
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
            onExitEdit={exitEdit}
          />
        ))}

        {status !== "pending" && history.length ? (
          <section className="pub-history-section">
            <HistoryList items={history} />
          </section>
        ) : null}

        {isEmpty ? (
          <section className="pub-empty">
            <span className="pub-empty-icon" aria-hidden>
              {status === "pending" ? <Check /> : <Inbox />}
            </span>
            <h2 className="pub-empty-title">
              {status === "pending"
                ? "Wszystko zaakceptowane"
                : "Brak postów dla tych filtrów"}
            </h2>
            <p className="pub-empty-text">
              {status === "pending" ? "Nic nie czeka na Twoją decyzję. " : ""}
              {topics.length ? "Wybierz tematy" : "Wygeneruj tematy"}, z których
              AI napisze posty, poproś o nie w czacie obok albo dodaj własny
              post.
            </p>
            <div className="pub-empty-actions">
              <Link href="/publikacje?nowy=1" className="ui-btn ui-btn-outline">
                <SquarePen aria-hidden />
                Nowy post
              </Link>
              <TopicsButton className="ui-btn ui-btn-primary" />
            </div>
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
        onExitEdit={exitEdit}
        runs={runs}
        onRunStarted={(runId, count) => trackRun(runId, count)}
        collapsed={collapsed}
        onToggleCollapsed={() => chatFlag.write(!collapsed)}
        mobileOpen={mobileOpen}
        onMobileOpenChange={(open) => {
          setMobileOpen(open);
          if (open && collapsed) chatFlag.write(false);
        }}
      />
    </div>
  );
}
