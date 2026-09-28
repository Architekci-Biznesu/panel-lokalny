"use client";

import { Loader2, Plus, Sparkles, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
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

/**
 * "Tematy postów": the customer picks topics (max 10), edits them, adds own
 * ones or asks AI for more - only then AI writes posts from the chosen ones.
 * Topics not chosen stay for later.
 */
export function TopicPicker({
  topics,
  pendingTopics,
  onRunStarted,
  onClose,
}: {
  topics: TopicItem[];
  /** Topics AI is still writing (running "topics" runs) */
  pendingTopics: number;
  onRunStarted: (
    runId: string,
    count: number,
    kind: "posts" | "topics",
  ) => void;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [asking, setAsking] = useState(false);
  const askedRef = useRef(false);

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

  // Fewer than 5 topics waiting and AI is not already on it - ask right away.
  useEffect(() => {
    if (
      askedRef.current ||
      topics.length >= TOPICS_BATCH ||
      pendingTopics > 0
    ) {
      return;
    }
    askedRef.current = true;
    void requestTopics();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, when the panel opens
  }, []);

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
      onClose();
    });
  }

  return (
    <section className="ui-section pub-topics" aria-label="Tematy postów">
      <header className="pub-topics-head">
        <div>
          <h2 className="pub-topics-title">Tematy postów</h2>
          <p className="pub-topics-sub">
            Zaznacz tematy (maks. {MAX_TOPICS_TO_WRITE}), popraw je albo dopisz
            własne - AI napisze posty tylko z wybranych.
          </p>
        </div>
        <button
          type="button"
          className="ui-btn ui-btn-ghost ui-btn-sm"
          aria-label="Zamknij"
          onClick={onClose}
        >
          <X aria-hidden />
        </button>
      </header>

      <ul className="pub-topic-list">
        {topics.map((topic) => {
          const checked = chosen.includes(topic.id);
          return (
            <li
              key={topic.id}
              className={`pub-topic${checked ? " is-checked" : ""}`}
            >
              <input
                type="checkbox"
                className="ui-check"
                checked={checked}
                disabled={pending || (!checked && full)}
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
                  {topic.title}
                  {topic.origin === "manual" ? (
                    <span className="ui-pill ui-pill-neutral">Twój</span>
                  ) : null}
                </button>
              )}
              <button
                type="button"
                className="ui-btn ui-btn-ghost ui-btn-sm pub-topic-remove"
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
              style={{ width: `${60 + ((i * 13) % 30)}%`, height: "0.75rem" }}
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
          className="ui-btn ui-btn-white"
          disabled={pending || !newTitle.trim()}
          onClick={add}
        >
          <Plus aria-hidden />
          Dodaj
        </button>
      </div>

      <div className="pub-topic-more">
        <button
          type="button"
          className="ui-btn ui-btn-white ui-btn-sm"
          disabled={asking || pendingTopics > 0}
          onClick={askForMore}
        >
          {asking || pendingTopics > 0 ? (
            <Loader2 aria-hidden className="ui-btn-spinner" />
          ) : (
            <Sparkles aria-hidden />
          )}
          Zaproponuj kolejne tematy
        </button>
      </div>

      <footer className="pub-topics-foot">
        <span className="pub-topics-count">
          Wybrano{" "}
          <span className="mono">
            {chosen.length} / {MAX_TOPICS_TO_WRITE}
          </span>
        </span>
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
      </footer>
    </section>
  );
}
