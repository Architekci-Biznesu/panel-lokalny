"use client";

/*
 * Chat panel adapted from Beautiful UI "Chat" (https://www.beautifului.dev),
 * MIT License, Copyright (c) 2026 Shane Levine - see beautiful-ui.LICENSE.
 * Changes: real server actions instead of scripted replies, version
 * comparison on the Styl 4 .ui-compare-* block, Styl 4 tokens via
 * .pub-chat-* classes, Polish copy.
 */

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { ArrowUp, ImagePlus, Loader2, RotateCcw, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "gooey-toast";
import {
  applyContentRevision,
  previewContentRevision,
  undoContentRevision,
} from "@/features/publikacje/actions";
import { ThinkingTrace } from "@/features/publikacje/components/thinking-trace";

type Message =
  | { id: string; role: "user"; text: string }
  | { id: string; role: "note"; text: string }
  | {
      id: string;
      role: "proposal";
      instruction: string;
      previousBody: string;
      body: string;
      newImagePrompt: string | null;
      state: "open" | "saved" | "discarded";
    };

const SUGGESTIONS = [
  "Krócej, maks. 3 zdania",
  "Bardziej na luzie",
  "Dodaj zachętę do telefonu",
  "Daj inną grafikę",
];

const REVISE_STEPS = [
  "Czytam obecną treść",
  "Wprowadzam Twoją prośbę",
  "Sprawdzam zakazy z kontekstu firmy",
];

export function ChatEditPanel({
  item,
  open,
  onOpenChange,
}: {
  item: {
    id: string;
    title: string;
    body: string;
    imageUrl: string | null;
    revisionCount: number;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [body, setBody] = useState(item.body);
  const [revisions, setRevisions] = useState(item.revisionCount);
  const [working, setWorking] = useState<"revise" | "apply" | "undo" | null>(
    null,
  );
  const [, startTransition] = useTransition();
  const threadRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    threadRef.current?.scrollTo({
      top: threadRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, working]);

  const busy = working !== null;
  const canSend = draft.trim().length >= 2 && !busy;

  function patchProposal(id: string, state: "saved" | "discarded") {
    setMessages((list) =>
      list.map((m) =>
        m.id === id && m.role === "proposal" ? { ...m, state } : m,
      ),
    );
  }

  async function send(text: string) {
    const instruction = text.trim();
    if (instruction.length < 2 || busy) return;
    setDraft("");
    setMessages((list) => [
      ...list.map((m) =>
        m.role === "proposal" && m.state === "open"
          ? { ...m, state: "discarded" as const }
          : m,
      ),
      { id: crypto.randomUUID(), role: "user", text: instruction },
    ]);
    setWorking("revise");
    const result = await previewContentRevision({
      itemId: item.id,
      instruction,
    });
    setWorking(null);
    if (!result.ok) {
      toast.error({
        title: "AI nie przygotowało wersji",
        description: result.error,
      });
      return;
    }
    setMessages((list) => [
      ...list,
      {
        id: crypto.randomUUID(),
        role: "proposal",
        instruction,
        previousBody: body,
        body: result.body,
        newImagePrompt: result.newImagePrompt,
        state: "open",
      },
    ]);
  }

  async function save(message: Extract<Message, { role: "proposal" }>) {
    setWorking("apply");
    const result = await applyContentRevision({
      itemId: item.id,
      instruction: message.instruction,
      body: message.body,
      newImagePrompt: message.newImagePrompt,
    });
    setWorking(null);
    if (!result.ok) {
      toast.error({ title: "Nie zapisano wersji", description: result.error });
      return;
    }
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
    setBody(result.body);
    setRevisions((n) => Math.max(0, n - 1));
    setMessages((list) => [
      ...list,
      {
        id: crypto.randomUUID(),
        role: "note",
        text: "Przywrócono poprzednią wersję posta.",
      },
    ]);
    toast.success({ title: "Cofnięto ostatnią zmianę" });
    startTransition(() => router.refresh());
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="pub-chat-backdrop" />
        <DialogPrimitive.Popup className="pub-chat-panel">
          <header className="pub-chat-head">
            <div className="pub-chat-head-text">
              <DialogPrimitive.Title className="pub-chat-title">
                Edytuj przez czat
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="pub-chat-sub">
                {item.title}
              </DialogPrimitive.Description>
            </div>
            <DialogPrimitive.Close
              className="ui-btn ui-btn-ghost ui-btn-sm pub-chat-close"
              aria-label="Zamknij"
            >
              <X aria-hidden />
            </DialogPrimitive.Close>
          </header>

          <div className="pub-chat-thread" ref={threadRef}>
            <div className="pub-chat-current">
              <p className="pub-chat-label">Obecna treść</p>
              <p className="pub-chat-body">{body}</p>
            </div>

            {messages.length === 0 && !busy ? (
              <p className="pub-chat-hint">
                Napisz, co zmienić - np. skrócić, zmienić ton albo podmienić
                grafikę. Przed zapisem zobaczysz porównanie wersji.
              </p>
            ) : null}

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
                  <div className="ui-compare-cols pub-chat-compare">
                    <div className="ui-compare-col">
                      <div className="ui-compare-col-head">
                        <span>Obecnie</span>
                        <span className="ui-compare-count mono">
                          {message.previousBody.length} zn.
                        </span>
                      </div>
                      <p className="pub-chat-old">{message.previousBody}</p>
                    </div>
                    <div className="ui-compare-col ui-compare-col-next">
                      <div className="ui-compare-col-head">
                        <span>Po zmianie</span>
                        <span className="ui-compare-count mono">
                          {message.body.length} zn.
                        </span>
                      </div>
                      <p className="pub-chat-body">{message.body}</p>
                    </div>
                  </div>
                  {message.newImagePrompt ? (
                    <p className="pub-chat-image-note">
                      <ImagePlus aria-hidden />
                      Po zapisaniu AI wygeneruje nową grafikę.
                    </p>
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
                        Zapisz tę wersję
                      </button>
                    </div>
                  ) : null}
                </div>
              );
            })}

            {working === "revise" ? (
              <ThinkingTrace
                working
                steps={REVISE_STEPS}
                activeLabel="AI przepisuje post"
              />
            ) : null}
            {working === "apply" ? (
              <ThinkingTrace
                working
                steps={["Zapisuję wersję", "Tworzę grafikę, jeśli trzeba"]}
                activeLabel="Zapisuję"
                stepMs={2500}
              />
            ) : null}
          </div>

          <div className="pub-chat-foot">
            <div className="pub-chat-suggestions">
              {SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  className="pub-chat-chip"
                  disabled={busy}
                  onClick={() => void send(suggestion)}
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
                placeholder="Co zmienić w poście?"
                aria-label="Co zmienić w poście"
                disabled={busy}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void send(draft);
                  }
                }}
              />
              <div className="pub-chat-composer-row">
                {revisions > 0 ? (
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
                ) : (
                  <span />
                )}
                <button
                  type="button"
                  className="pub-chat-send"
                  aria-label="Wyślij"
                  disabled={!canSend}
                  onClick={() => void send(draft)}
                >
                  <ArrowUp aria-hidden />
                </button>
              </div>
            </div>
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
