"use client";

/*
 * Docked chat adapted from Beautiful UI "Chat" (https://www.beautifului.dev),
 * MIT License, Copyright (c) 2026 Shane Levine - see beautiful-ui.LICENSE.
 * Changes: real server actions instead of scripted replies, two modes (new
 * proposals / editing a post), version comparison on the Styl 4
 * .ui-compare-* block, Styl 4 tokens via .pub-chat-* classes, Polish copy.
 */

import {
  ArrowUp,
  ImagePlus,
  Loader2,
  MessageSquareText,
  PanelRightClose,
  PanelRightOpen,
  RotateCcw,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "gooey-toast";
import {
  applyContentRevision,
  routeChatMessage,
  chatAboutPost,
  undoContentRevision,
  type GenerationStatus,
} from "@/features/publikacje/actions";
import { ThinkingTrace } from "@/features/publikacje/components/thinking-trace";
import type { ChatTurn } from "@/lib/ai";

export type EditableItem = {
  id: string;
  title: string;
  body: string;
  revisionCount: number;
  /** Requests that already changed this post (saved), oldest first */
  recentInstructions: string[];
};

type GenerateMessage =
  | { id: string; role: "user"; text: string }
  | { id: string; role: "note"; text: string }
  /** AI's answer in the conversation (ideas, advice) */
  | { id: string; role: "reply"; text: string }
  | { id: string; role: "run"; runId: string; count: number };

type EditMessage =
  | { id: string; role: "user"; text: string }
  | { id: string; role: "note"; text: string }
  | { id: string; role: "reply"; text: string }
  | {
      id: string;
      role: "proposal";
      instruction: string;
      previousTitle: string;
      /** New title, or null when the change keeps the title */
      title: string | null;
      previousBody: string;
      body: string;
      newImagePrompt: string | null;
      state: "open" | "saved" | "discarded";
    };

/** A change routed from the general chat to one post ("zmień tytuł posta X"). */
export type EditRequest = {
  itemId: string;
  instruction: string;
  nonce: string;
};

const GENERATE_SUGGESTIONS = [
  "O czym warto pisać w tym miesiącu?",
  "Post z poradą dla klientów",
  "2 posty o naszych usługach",
];

const EDIT_SUGGESTIONS = [
  "Zaproponuj zdjęcie do tego posta",
  "Podpowiedz 3 tytuły",
  "Skróć do 3 zdań",
  "Dodaj zachętę do telefonu",
];

const REVISE_STEPS = [
  "Czytam post i rozmowę",
  "Sprawdzam zakazy z kontekstu firmy",
  "Przygotowuję odpowiedź",
];

const WRITE_STEPS = [
  "Czytam kontekst firmy",
  "Wybieram temat, którego jeszcze nie było",
  "Piszę post pod wizytówkę Google",
];

function newId() {
  return crypto.randomUUID();
}

function plural(count: number): string {
  if (count === 1) return "propozycję";
  return count < 5 ? "propozycje" : "propozycji";
}

/** Text box + black send button (Beautiful UI composer). */
function Composer({
  placeholder,
  suggestions,
  disabled,
  onSend,
  extra,
}: {
  placeholder: string;
  suggestions: string[];
  disabled: boolean;
  onSend: (text: string) => void;
  extra?: React.ReactNode;
}) {
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const canSend = draft.trim().length >= 1 && !disabled;

  function send(text: string) {
    if (!text.trim() || disabled) return;
    setDraft("");
    onSend(text.trim());
  }

  return (
    <div className="pub-chat-foot">
      <div className="pub-chat-suggestions">
        {suggestions.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            className="pub-chat-chip"
            disabled={disabled}
            onClick={() => send(suggestion)}
          >
            {suggestion}
          </button>
        ))}
      </div>
      <div
        className="pub-chat-composer"
        role="presentation"
        onClick={() => inputRef.current?.focus()}
      >
        <textarea
          ref={inputRef}
          className="pub-chat-input"
          rows={2}
          value={draft}
          placeholder={placeholder}
          aria-label={placeholder}
          disabled={disabled}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              send(draft);
            }
          }}
        />
        <div className="pub-chat-composer-row">
          {extra ?? <span />}
          <button
            type="button"
            className="pub-chat-send"
            aria-label="Wyślij"
            disabled={!canSend}
            onClick={() => send(draft)}
          >
            <ArrowUp aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
}

/** Scrolls the thread to the bottom whenever `signal` changes (new content). */
function useAutoScroll(signal: string) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.scrollTo({
      top: ref.current.scrollHeight,
      behavior: "smooth",
    });
  }, [signal]);
  return ref;
}

/**
 * Mode 1: no post selected. AI reads the message: new posts start a
 * background run, a change to an existing post switches to editing it.
 */
function GenerateThread({
  messages,
  setMessages,
  runs,
  onRunStarted,
  onEditRequest,
}: {
  messages: GenerateMessage[];
  setMessages: React.Dispatch<React.SetStateAction<GenerateMessage[]>>;
  runs: Map<string, GenerationStatus>;
  onRunStarted: (runId: string, count: number) => void;
  onEditRequest: (itemId: string, instruction: string) => void;
}) {
  const [sending, setSending] = useState(false);
  const threadRef = useAutoScroll(
    `${messages.length}:${[...runs.values()].map((r) => `${r.created}${r.status}`).join()}`,
  );
  const busy =
    sending ||
    messages.some(
      (m) => m.role === "run" && runs.get(m.runId)?.status === "running",
    );

  async function send(text: string) {
    setMessages((list) => [...list, { id: newId(), role: "user", text }]);
    setSending(true);
    // Earlier turns let the router read an answer to its own question.
    const history = messages
      .flatMap((m): ChatTurn[] =>
        m.role === "user"
          ? [{ role: "user", text: m.text }]
          : m.role === "note" || m.role === "reply"
            ? [{ role: "assistant", text: m.text }]
            : [],
      )
      .slice(-8);
    const result = await routeChatMessage({ message: text, history });
    setSending(false);
    if (!result.ok) {
      toast.error({ title: "AI nie odpowiedziało", description: result.error });
      return;
    }
    if (result.kind === "edit") {
      setMessages((list) => [
        ...list,
        {
          id: newId(),
          role: "note",
          text: `Otworzyłem edycję posta „${result.itemTitle}”.`,
        },
      ]);
      onEditRequest(result.itemId, result.instruction);
      return;
    }
    if (result.kind === "clarify" || result.kind === "reply") {
      setMessages((list) => [
        ...list,
        {
          id: newId(),
          role: "reply",
          text: result.kind === "reply" ? result.text : result.question,
        },
      ]);
      return;
    }
    onRunStarted(result.runId, result.count);
    setMessages((list) => [
      ...list,
      { id: newId(), role: "run", runId: result.runId, count: result.count },
    ]);
  }

  return (
    <>
      <div className="pub-chat-thread" ref={threadRef}>
        <p className="pub-chat-hint">
          Zapytaj o pomysły, poproś o nowe posty albo o zmianę w propozycji z
          listy (np. „zaproponuj zdjęcie do posta o oponach”). Zmiany wprowadzam
          dopiero, gdy o nie poprosisz.
        </p>
        {messages.map((message) => {
          if (message.role === "user") {
            return (
              <div key={message.id} className="pub-chat-user">
                <p>{message.text}</p>
              </div>
            );
          }
          if (message.role === "note") {
            return (
              <p key={message.id} className="pub-chat-note">
                {message.text}
              </p>
            );
          }
          if (message.role === "reply") {
            return (
              <p key={message.id} className="pub-chat-reply">
                {message.text}
              </p>
            );
          }
          const run = runs.get(message.runId);
          if (!run || run.status === "running") {
            return (
              <ThinkingTrace
                key={message.id}
                steps={WRITE_STEPS}
                activeLabel={`Piszę ${run ? run.created + 1 : 1} z ${message.count}`}
              />
            );
          }
          return (
            <p key={message.id} className="pub-chat-note">
              {run.status === "done"
                ? `Dodałem ${run.created} ${plural(run.created)} do listy.`
                : (run.error ?? "Nie udało się przygotować propozycji.")}
            </p>
          );
        })}
        {sending ? (
          <ThinkingTrace
            steps={["Czytam wiadomość", "Sprawdzam propozycje na liście"]}
            activeLabel="Rozumiem, o co chodzi"
          />
        ) : null}
      </div>
      <Composer
        placeholder="Nowe posty albo zmiana w istniejącym"
        suggestions={GENERATE_SUGGESTIONS}
        disabled={busy}
        onSend={(text) => void send(text)}
      />
    </>
  );
}

/** Mode 2: editing one proposal - preview, compare, save or undo. */
function EditThread({
  item,
  initialInstruction,
  carryOver,
  onExit,
}: {
  item: EditableItem;
  /** Change routed from the general chat - previewed right away. */
  initialInstruction: string | null;
  /** The general-chat conversation that led here (shown above, sent to AI) */
  carryOver: ChatTurn[];
  onExit: () => void;
}) {
  const router = useRouter();
  const [messages, setMessages] = useState<EditMessage[]>(() =>
    initialInstruction
      ? [{ id: newId(), role: "user", text: initialInstruction }]
      : [],
  );
  const [title, setTitle] = useState(item.title);
  const [body, setBody] = useState(item.body);
  const [revisions, setRevisions] = useState(item.revisionCount);
  const [working, setWorking] = useState<"revise" | "apply" | "undo" | null>(
    initialInstruction ? "revise" : null,
  );
  const [, startTransition] = useTransition();
  const threadRef = useAutoScroll(`${messages.length}:${working}`);
  const busy = working !== null;
  const startedRef = useRef(false);

  /**
   * Sends a message to the post chat: AI answers, or - on an explicit
   * request - prepares a version to compare. State changes only after the
   * response.
   */
  async function requestAnswer(
    message: string,
    previousTitle: string,
    previousBody: string,
    earlier: EditMessage[],
  ) {
    // The whole conversation so far - "tak, zrób ten drugi" needs AI's answers.
    const conversation: ChatTurn[] = [
      ...carryOver,
      ...earlier.flatMap((m): ChatTurn[] =>
        m.role === "user"
          ? [{ role: "user", text: m.text }]
          : m.role === "reply"
            ? [{ role: "assistant", text: m.text }]
            : [],
      ),
    ].slice(-12);
    const result = await chatAboutPost({
      itemId: item.id,
      message,
      conversation,
    });
    setWorking(null);
    if (!result.ok) {
      toast.error({ title: "AI nie odpowiedziało", description: result.error });
      return;
    }
    if (result.kind === "reply") {
      setMessages((list) => [
        ...list,
        { id: newId(), role: "reply", text: result.text },
      ]);
      return;
    }
    setMessages((list) => [
      // A newer proposal replaces the one still waiting.
      ...list.map((m) =>
        m.role === "proposal" && m.state === "open"
          ? { ...m, state: "discarded" as const }
          : m,
      ),
      {
        id: newId(),
        role: "proposal",
        instruction: result.instruction,
        previousTitle,
        title: result.title,
        previousBody,
        body: result.body,
        newImagePrompt: result.newImagePrompt,
        state: "open",
      },
    ]);
  }

  // A change routed from the general chat starts as soon as the post opens.
  useEffect(() => {
    if (!initialInstruction || startedRef.current) return;
    startedRef.current = true;
    void requestAnswer(initialInstruction, item.title, item.body, []);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once per mount (the thread is keyed per request)
  }, []);

  function patchProposal(id: string, state: "saved" | "discarded") {
    setMessages((list) =>
      list.map((m) =>
        m.id === id && m.role === "proposal" ? { ...m, state } : m,
      ),
    );
  }

  async function send(text: string) {
    setMessages((list) => [...list, { id: newId(), role: "user", text }]);
    setWorking("revise");
    await requestAnswer(text, title, body, messages);
  }

  async function save(message: Extract<EditMessage, { role: "proposal" }>) {
    setWorking("apply");
    const result = await applyContentRevision({
      itemId: item.id,
      instruction: message.instruction,
      title: message.title,
      body: message.body,
      newImagePrompt: message.newImagePrompt,
    });
    setWorking(null);
    if (!result.ok) {
      toast.error({ title: "Nie zapisano wersji", description: result.error });
      return;
    }
    setTitle(result.title);
    setBody(result.body);
    setRevisions((n) => n + 1);
    patchProposal(message.id, "saved");
    toast.success({ title: "Zapisano nową wersję posta" });
    startTransition(() => router.refresh());
  }

  async function undo() {
    setWorking("undo");
    const result = await undoContentRevision({ itemId: item.id });
    setWorking(null);
    if (!result.ok) {
      toast.error({ title: "Nie cofnięto zmiany", description: result.error });
      return;
    }
    setTitle(result.title);
    setBody(result.body);
    setRevisions((n) => Math.max(0, n - 1));
    setMessages((list) => [
      ...list,
      {
        id: newId(),
        role: "note",
        text: "Przywrócono poprzednią wersję posta.",
      },
    ]);
    toast.success({ title: "Cofnięto ostatnią zmianę" });
    startTransition(() => router.refresh());
  }

  return (
    <>
      <div className="pub-chat-editing">
        <span className="pub-chat-editing-label">Edytujesz</span>
        <span className="pub-chat-editing-title">{title}</span>
        <button
          type="button"
          className="ui-btn ui-btn-ghost ui-btn-sm"
          aria-label="Zakończ edycję"
          onClick={onExit}
        >
          <X aria-hidden />
        </button>
      </div>
      <div className="pub-chat-thread" ref={threadRef}>
        {carryOver.length ? (
          <div className="pub-chat-earlier">
            <p className="pub-chat-label">Wcześniej w czacie</p>
            {carryOver.map((turn, index) =>
              turn.role === "user" ? (
                <div key={index} className="pub-chat-user">
                  <p>{turn.text}</p>
                </div>
              ) : (
                <p key={index} className="pub-chat-note">
                  {turn.text}
                </p>
              ),
            )}
          </div>
        ) : null}
        {item.recentInstructions.length ? (
          <div className="pub-chat-history">
            <p className="pub-chat-label">Wcześniejsze zmiany tego posta</p>
            <ul className="pub-chat-history-list">
              {item.recentInstructions.map((instruction, index) => (
                <li key={index}>{instruction}</li>
              ))}
            </ul>
          </div>
        ) : null}
        <div className="pub-chat-current">
          <p className="pub-chat-label">Obecny post</p>
          <p className="pub-chat-post-title">{title}</p>
          <p className="pub-chat-body">{body}</p>
        </div>

        {messages.map((message) => {
          if (message.role === "user") {
            return (
              <div key={message.id} className="pub-chat-user">
                <p>{message.text}</p>
              </div>
            );
          }
          if (message.role === "note") {
            return (
              <p key={message.id} className="pub-chat-note">
                {message.text}
              </p>
            );
          }
          if (message.role === "reply") {
            return (
              <p key={message.id} className="pub-chat-reply">
                {message.text}
              </p>
            );
          }
          const textChanged =
            Boolean(message.title) || message.body !== message.previousBody;
          if (!textChanged && !message.newImagePrompt) {
            return (
              <p key={message.id} className="pub-chat-note">
                AI nie zaproponowało żadnej zmiany. Napisz dokładniej, co
                zmienić w tytule, treści albo grafice.
              </p>
            );
          }
          return (
            <div
              key={message.id}
              className={`pub-chat-proposal is-${message.state}`}
            >
              <p className="pub-chat-label">
                {message.state === "saved"
                  ? "Zapisana wersja"
                  : message.state === "discarded"
                    ? "Pominięta wersja"
                    : "Propozycja AI"}
              </p>
              {textChanged ? (
                <div className="ui-compare-cols pub-chat-compare">
                  <div className="ui-compare-col">
                    <div className="ui-compare-col-head">
                      <span>Obecnie</span>
                      <span className="ui-compare-count mono">
                        {message.previousBody.length} zn.
                      </span>
                    </div>
                    {message.title ? (
                      <p className="pub-chat-post-title pub-chat-old">
                        {message.previousTitle}
                      </p>
                    ) : null}
                    <p className="pub-chat-old">
                      {message.body === message.previousBody
                        ? "Treść bez zmian"
                        : message.previousBody}
                    </p>
                  </div>
                  <div className="ui-compare-col ui-compare-col-next">
                    <div className="ui-compare-col-head">
                      <span>Po zmianie</span>
                      <span className="ui-compare-count mono">
                        {message.body.length} zn.
                      </span>
                    </div>
                    {message.title ? (
                      <p className="pub-chat-post-title">{message.title}</p>
                    ) : null}
                    <p className="pub-chat-body">
                      {message.body === message.previousBody
                        ? "Treść bez zmian"
                        : message.body}
                    </p>
                  </div>
                </div>
              ) : null}
              {message.newImagePrompt ? (
                <div className="pub-chat-image">
                  <p className="pub-chat-image-note">
                    <ImagePlus aria-hidden />
                    Nowa grafika - powstanie po kliknięciu „Zapisz”
                  </p>
                  <p className="pub-chat-body">
                    Na zdjęciu: {message.newImagePrompt}
                  </p>
                </div>
              ) : null}
              {message.state === "open" ? (
                <div className="pub-chat-proposal-actions">
                  <button
                    type="button"
                    className="ui-btn ui-btn-ghost ui-btn-sm"
                    disabled={busy}
                    onClick={() => patchProposal(message.id, "discarded")}
                  >
                    Pomiń
                  </button>
                  <button
                    type="button"
                    className="ui-btn ui-btn-primary ui-btn-sm"
                    disabled={busy}
                    onClick={() => void save(message)}
                  >
                    {working === "apply" ? (
                      <Loader2 aria-hidden className="ui-btn-spinner" />
                    ) : null}
                    {textChanged
                      ? "Zapisz tę wersję"
                      : "Zapisz i utwórz grafikę"}
                  </button>
                </div>
              ) : null}
            </div>
          );
        })}

        {working === "revise" ? (
          <ThinkingTrace steps={REVISE_STEPS} activeLabel="AI myśli" />
        ) : null}
        {working === "apply" ? (
          <ThinkingTrace
            steps={["Zapisuję wersję", "Tworzę grafikę, jeśli trzeba"]}
            activeLabel="Zapisuję"
            stepMs={2500}
          />
        ) : null}
      </div>
      <Composer
        placeholder="Zapytaj albo poproś o zmianę"
        suggestions={EDIT_SUGGESTIONS}
        disabled={busy}
        onSend={(text) => void send(text)}
        extra={
          revisions > 0 ? (
            <button
              type="button"
              className="ui-btn ui-btn-ghost ui-btn-sm"
              disabled={busy}
              onClick={() => void undo()}
            >
              {working === "undo" ? (
                <Loader2 aria-hidden className="ui-btn-spinner" />
              ) : (
                <RotateCcw aria-hidden />
              )}
              Cofnij ostatnią zmianę
            </button>
          ) : null
        }
      />
    </>
  );
}

/**
 * AI chat docked next to the post list. Without a selected post it writes new
 * proposals; with one it edits that post. Collapses to a slim rail (desktop)
 * or a bottom sheet (mobile).
 */
export function ContentChat({
  editing,
  editRequest,
  onEditRequest,
  onExitEdit,
  runs,
  onRunStarted,
  collapsed,
  onToggleCollapsed,
  mobileOpen,
  onMobileOpenChange,
}: {
  editing: EditableItem | null;
  /** Latest change routed from the general chat (starts the edit thread). */
  editRequest: EditRequest | null;
  onEditRequest: (itemId: string, instruction: string) => void;
  onExitEdit: () => void;
  runs: Map<string, GenerationStatus>;
  onRunStarted: (runId: string, count: number) => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  mobileOpen: boolean;
  onMobileOpenChange: (open: boolean) => void;
}) {
  const [generateMessages, setGenerateMessages] = useState<GenerateMessage[]>(
    [],
  );

  return (
    <>
      <aside
        className={`pub-chat-dock${collapsed ? " is-collapsed" : ""}${mobileOpen ? " is-mobile-open" : ""}`}
        aria-label="Czat AI"
      >
        {collapsed ? (
          <button
            type="button"
            className="pub-chat-rail"
            onClick={onToggleCollapsed}
            aria-label="Rozwiń czat AI"
          >
            <PanelRightOpen aria-hidden />
            <span>Czat AI</span>
          </button>
        ) : (
          <>
            <header className="pub-chat-head">
              <div className="pub-chat-head-text">
                <h2 className="pub-chat-title">Czat AI</h2>
                <p className="pub-chat-sub">
                  {editing ? "Edycja propozycji" : "Nowe propozycje postów"}
                </p>
              </div>
              <button
                type="button"
                className="ui-btn ui-btn-ghost ui-btn-sm pub-chat-collapse"
                onClick={onToggleCollapsed}
                aria-label="Zwiń czat"
              >
                <PanelRightClose aria-hidden />
              </button>
              <button
                type="button"
                className="ui-btn ui-btn-ghost ui-btn-sm pub-chat-mobile-close"
                onClick={() => onMobileOpenChange(false)}
                aria-label="Zamknij czat"
              >
                <X aria-hidden />
              </button>
            </header>
            {editing ? (
              <EditThread
                key={`${editing.id}:${editRequest?.itemId === editing.id ? editRequest.nonce : "manual"}`}
                item={editing}
                initialInstruction={
                  editRequest?.itemId === editing.id
                    ? editRequest.instruction
                    : null
                }
                carryOver={
                  editRequest?.itemId === editing.id
                    ? generateMessages.flatMap((m): ChatTurn[] =>
                        m.role === "user"
                          ? [{ role: "user", text: m.text }]
                          : m.role === "note" || m.role === "reply"
                            ? [{ role: "assistant", text: m.text }]
                            : [],
                      )
                    : []
                }
                onExit={onExitEdit}
              />
            ) : (
              <GenerateThread
                messages={generateMessages}
                setMessages={setGenerateMessages}
                runs={runs}
                onRunStarted={onRunStarted}
                onEditRequest={onEditRequest}
              />
            )}
          </>
        )}
      </aside>

      <button
        type="button"
        className="ui-btn ui-btn-primary pub-chat-fab"
        onClick={() => onMobileOpenChange(true)}
      >
        <MessageSquareText aria-hidden />
        Czat AI
      </button>
    </>
  );
}
