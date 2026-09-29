"use client";

import {
  ChevronDown,
  ChevronUp,
  Loader2,
  Pencil,
  Plus,
  Sparkles,
  UserRound,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "gooey-toast";
import {
  addTopic,
  dismissTopic,
  suggestTopics,
  updateTopic,
  writePostsFromTopics,
} from "@/features/publikacje/actions";
import {
  MAX_TOPICS_TO_WRITE,
  TOPICS_BATCH,
} from "@/features/publikacje/generation-rules";
import type { TopicItem } from "@/features/publikacje/load-inbox";

function topicsWord(count: number): string {
  if (count === 1) return "temat";
  const last = count % 10;
  const lastTwo = count % 100;
  return last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)
    ? "tematy"
    : "tematów";
}

/**
 * "Tematy postów": the customer picks topics (max 10), edits them, adds own
 * ones or asks AI for more - only then AI writes posts from the chosen ones.
 * Topics not chosen stay for later. Always shown while there are topics;
 * can be collapsed to a bar (like the chat) - selection survives that.
 */
export function TopicPicker({
  topics,
  pendingTopics,
  collapsed,
  onToggleCollapsed,
  onRunStarted,
}: {
  topics: TopicItem[];
  /** Topics AI is still writing (running "topics" runs) */
  pendingTopics: number;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onRunStarted: (
    runId: string,
    count: number,
    kind: "posts" | "topics",
  ) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [asking, setAsking] = useState(false);

  const ids = new Set(topics.map((t) => t.id));
  const chosen = selected.filter((id) => ids.has(id));
  const full = chosen.length >= MAX_TOPICS_TO_WRITE;

  /** Starts a "topics" run; state changes only after the response. */
  async function requestTopics() {
    const result = await suggestTopics();
    if (!result.ok) {
      toast.error({
        title: "AI nie zaproponowało tematów",
        description: result.error,
      });
      return;
    }
    onRunStarted(result.runId, TOPICS_BATCH, "topics");
  }

  function askForMore() {
    setAsking(true);
    void requestTopics().finally(() => setAsking(false));
  }

  function toggle(id: string) {
    setSelected((list) =>
      list.includes(id)
        ? list.filter((item) => item !== id)
        : full
          ? list
          : [...list, id],
    );
  }

  function saveEdit(topic: TopicItem) {
    const title = draft.trim();
    if (title === topic.title) {
      setEditingId(null);
      return;
    }
    startTransition(async () => {
      const result = await updateTopic({ topicId: topic.id, title });
      if (!result.ok) {
        toast.error({
          title: "Nie zapisano tematu",
          description: result.error,
        });
        return;
      }
      setEditingId(null);
      router.refresh();
    });
  }

  function remove(topic: TopicItem) {
    startTransition(async () => {
      const result = await dismissTopic({ topicId: topic.id });
      if (!result.ok) {
        toast.error({
          title: "Nie usunięto tematu",
          description: result.error,
        });
        return;
      }
      setSelected((list) => list.filter((id) => id !== topic.id));
      router.refresh();
    });
  }

  function add() {
    const title = newTitle.trim();
    if (!title) return;
    startTransition(async () => {
      const result = await addTopic({ title });
      if (!result.ok) {
        toast.error({ title: "Nie dodano tematu", description: result.error });
        return;
      }
      setNewTitle("");
      // Own topic is usually meant to be written - select it right away.
      setSelected((list) =>
        list.length < MAX_TOPICS_TO_WRITE ? [...list, result.topicId] : list,
      );
      router.refresh();
    });
  }

  function write() {
    if (!chosen.length) {
      toast.error({ title: "Zaznacz co najmniej jeden temat" });
      return;
    }
    startTransition(async () => {
      const result = await writePostsFromTopics({ topicIds: chosen });
      if (!result.ok) {
        toast.error({
          title: "AI nie zaczęło pisać",
          description: result.error,
        });
        return;
      }
      toast.info({
        title: `AI pisze ${result.count} ${result.count === 1 ? "post" : result.count < 5 ? "posty" : "postów"}`,
        description: "Pojawią się na liście po kolei.",
      });
      onRunStarted(result.runId, result.count, "posts");
      setSelected([]);
      onToggleCollapsed();
    });
  }

  if (collapsed) {
    const writing = pendingTopics > 0 && !topics.length;
    return (
      <div className="pub-topics-banner" role="note">
        <span className="pub-topics-banner-icon" aria-hidden>
          {writing ? <Loader2 className="pub-spin" /> : <Sparkles />}
        </span>
        <p>
          {writing ? (
            "AI przygotowuje tematy postów…"
          ) : (
            <>
              <strong>
                {topics.length} {topicsWord(topics.length)} do wyboru
              </strong>
              {chosen.length ? ` · zaznaczono ${chosen.length}` : null}
              {" - AI napisze posty z tych, które zaznaczysz."}
            </>
          )}
        </p>
        <button
          type="button"
          className="ui-btn ui-btn-primary ui-btn-sm"
          aria-expanded={false}
          onClick={onToggleCollapsed}
        >
          <ChevronDown aria-hidden />
          Pokaż tematy
        </button>
      </div>
    );
  }

  return (
    <section className="pub-panel" aria-labelledby="pub-topics-title">
      <header className="pub-panel-head">
        <div className="pub-panel-titles">
          <h2 id="pub-topics-title" className="pub-panel-title">
            Tematy postów
          </h2>
          <p className="pub-panel-sub">
            Zaznacz tematy (maks. {MAX_TOPICS_TO_WRITE}), popraw je albo dopisz
            własne - AI napisze posty tylko z wybranych. Niewybrane poczekają na
            później.
          </p>
        </div>
        <button
          type="button"
          className="ui-btn ui-btn-ghost ui-btn-sm pub-panel-close"
          aria-label="Zwiń tematy"
          aria-expanded
          onClick={onToggleCollapsed}
        >
          <ChevronUp aria-hidden />
        </button>
      </header>

      <ul className="pub-topic-list">
        {topics.map((topic) => {
          const checked = chosen.includes(topic.id);
          const locked = !checked && full;
          return (
            <li
              key={topic.id}
              className={`pub-topic${checked ? " is-checked" : ""}${locked ? " is-locked" : ""}`}
            >
              <input
                type="checkbox"
                className="ui-check pub-topic-check"
                checked={checked}
                disabled={pending || locked}
                aria-label={`Wybierz temat: ${topic.title}`}
                onChange={() => toggle(topic.id)}
              />
              {editingId === topic.id ? (
                <input
                  className="ui-field pub-topic-input"
                  value={draft}
                  maxLength={160}
                  aria-label="Temat"
                  autoFocus
                  disabled={pending}
                  onChange={(event) => setDraft(event.target.value)}
                  onBlur={() => saveEdit(topic)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      saveEdit(topic);
                    }
                    if (event.key === "Escape") setEditingId(null);
                  }}
                />
              ) : (
                <button
                  type="button"
                  className="pub-topic-text"
                  disabled={pending}
                  onClick={() => {
                    setDraft(topic.title);
                    setEditingId(topic.id);
                  }}
                  aria-label={`Edytuj temat: ${topic.title}`}
                >
                  <span className="pub-topic-title">{topic.title}</span>
                  {topic.origin === "manual" ? (
                    <span className="pub-origin is-manual">
                      <UserRound aria-hidden />
                      Twój
                    </span>
                  ) : null}
                  <Pencil aria-hidden className="pub-topic-pen" />
                </button>
              )}
              <button
                type="button"
                className="pub-icon-btn"
                aria-label={`Usuń temat: ${topic.title}`}
                disabled={pending}
                onClick={() => remove(topic)}
              >
                <X aria-hidden />
              </button>
            </li>
          );
        })}
        {Array.from({ length: pendingTopics }, (_, i) => (
          <li
            key={`pending-${i}`}
            className="pub-topic is-loading"
            aria-busy="true"
          >
            <Sparkles aria-hidden />
            <span
              className="ui-skel"
              style={{ width: `${48 + ((i * 13) % 30)}%`, height: "0.625rem" }}
            />
          </li>
        ))}
        {!topics.length && !pendingTopics ? (
          <li className="pub-topic-empty">
            Brak tematów - poproś AI o propozycje albo dopisz własny.
          </li>
        ) : null}
      </ul>

      <div className="pub-topic-add">
        <input
          className="ui-field"
          value={newTitle}
          maxLength={160}
          placeholder="Dopisz własny temat i naciśnij Enter"
          aria-label="Własny temat"
          disabled={pending}
          onChange={(event) => setNewTitle(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              add();
            }
          }}
        />
        <button
          type="button"
          className="ui-btn ui-btn-secondary"
          disabled={pending || !newTitle.trim()}
          onClick={add}
        >
          <Plus aria-hidden />
          Dodaj
        </button>
        <span className="pub-topic-add-sep" aria-hidden />
        <button
          type="button"
          className="ui-btn pub-btn-brand"
          disabled={asking || pendingTopics > 0}
          onClick={askForMore}
        >
          {asking || pendingTopics > 0 ? (
            <Loader2 aria-hidden className="ui-btn-spinner" />
          ) : (
            <Sparkles aria-hidden />
          )}
          Zaproponuj kolejne
        </button>
      </div>

      <footer className="pub-panel-foot">
        <div className="pub-topics-count">
          <span>
            Wybrano{" "}
            <span className="mono">
              {chosen.length} / {MAX_TOPICS_TO_WRITE}
            </span>
          </span>
          <span className="pub-topics-meter" aria-hidden>
            {Array.from({ length: MAX_TOPICS_TO_WRITE }, (_, i) => (
              <span
                key={i}
                className={i < chosen.length ? "is-on" : undefined}
              />
            ))}
          </span>
        </div>
        <div className="pub-panel-actions">
          <button
            type="button"
            className="ui-btn ui-btn-secondary"
            disabled={pending || !chosen.length}
            onClick={() => setSelected([])}
          >
            Wyczyść
          </button>
          <button
            type="button"
            className="ui-btn ui-btn-primary"
            disabled={pending || !chosen.length}
            onClick={write}
          >
            {pending ? (
              <Loader2 aria-hidden className="ui-btn-spinner" />
            ) : (
              <Sparkles aria-hidden />
            )}
            Napisz posty{chosen.length ? ` (${chosen.length})` : ""}
          </button>
        </div>
      </footer>
    </section>
  );
}
