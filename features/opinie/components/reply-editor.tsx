"use client";

import { Loader2, Send, ShieldCheck, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "@/lib/toast";
import {
  ReasonPopover,
  type ReasonPopoverCopy,
} from "@/components/ui/reject-popover";
import {
  discardReviewDraftAction,
  publishReviewReplyAction,
  requestReviewDraft,
  saveReviewDraftText,
} from "@/features/opinie/actions";
import type { ReviewItem } from "@/features/opinie/load-reviews";
import { REPLY_MAX_BYTES, byteLength } from "@/features/opinie/review-rules";

const REGENERATE_COPY: ReasonPopoverCopy = {
  trigger: "Wygeneruj ponownie",
  triggerIcon: <Sparkles aria-hidden />,
  triggerClassName: "ui-btn ui-btn-outline ui-btn-sm",
  label: "Wygeneruj odpowiedź ponownie",
  title: "Wygenerować ponownie?",
  description:
    "Instrukcja jest opcjonalna. AI napisze nową odpowiedź, a obecny szkic zostanie zastąpiony.",
  quickReasons: ["Krócej", "Cieplej", "Bardziej formalnie"],
  fieldLabel: "Instrukcja dla AI",
  placeholder: "Np. wspomnij o nowym grafiku",
  confirm: "Wygeneruj",
  confirmIcon: <Sparkles aria-hidden />,
  confirmClassName: "ui-btn ui-btn-primary ui-btn-sm",
};

/**
 * The draft of a reply, editable in place. Typing never touches the reply that
 * is public in Google - only "Opublikuj" sends it (and replaces the old one).
 */
export function ReplyEditor({ item }: { item: ReviewItem }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [text, setText] = useState(item.draftText ?? "");
  const [regenerating, setRegenerating] = useState(false);

  const editingPublished = item.replyText !== null;
  const bytes = byteLength(text);
  const over = bytes > REPLY_MAX_BYTES;
  const writing = item.draftStatus === "generating" || regenerating;

  function saveOnBlur() {
    if (text === (item.draftText ?? "") || over || !text.trim()) return;
    startTransition(async () => {
      const result = await saveReviewDraftText({ reviewId: item.id, text });
      if (!result.ok) {
        toast.error({
          title: "Nie zapisano szkicu",
          description: result.error,
        });
      }
    });
  }

  function publish() {
    startTransition(async () => {
      const result = await publishReviewReplyAction({
        reviewId: item.id,
        text,
      });
      if (!result.ok) {
        toast.error({ title: "Nie opublikowano", description: result.error });
        router.refresh();
        return;
      }
      toast.success({ title: "Odpowiedź opublikowana w Google" });
      router.refresh();
    });
  }

  function regenerate(instruction: string | undefined) {
    setRegenerating(true);
    startTransition(async () => {
      const result = await requestReviewDraft({
        reviewId: item.id,
        instruction,
      });
      if (!result.ok) {
        toast.error({
          title: "AI nie napisało odpowiedzi",
          description: result.error,
        });
      }
      setRegenerating(false);
      router.refresh();
    });
  }

  function discard() {
    startTransition(async () => {
      const result = await discardReviewDraftAction({ reviewId: item.id });
      if (!result.ok) {
        toast.error({
          title: "Nie odrzucono szkicu",
          description: result.error,
        });
        return;
      }
      router.refresh();
    });
  }

  if (writing) {
    return (
      <div className="op-reply is-draft" aria-busy="true">
        <p className="op-reply-label is-ai">
          <Sparkles aria-hidden />
          <span className="op-shimmer">AI pisze odpowiedź…</span>
        </p>
        <span
          className="ui-skel"
          style={{ width: "100%", height: "0.75rem" }}
        />
        <span className="ui-skel" style={{ width: "88%", height: "0.75rem" }} />
        <span className="ui-skel" style={{ width: "62%", height: "0.75rem" }} />
      </div>
    );
  }

  return (
    <div className="op-reply is-draft">
      <div className="op-reply-top">
        {editingPublished ? (
          <p className="op-reply-label">Edytujesz opublikowaną odpowiedź</p>
        ) : (
          <p className="op-reply-label is-ai">
            <Sparkles aria-hidden />
            Szkic odpowiedzi od AI
          </p>
        )}
        <span className={`op-counter mono${over ? " is-over" : ""}`}>
          {bytes} / {REPLY_MAX_BYTES} B
        </span>
      </div>
      {editingPublished ? (
        <p className="op-reply-hint">
          W Google obowiązuje dotychczasowa wersja, dopóki nie klikniesz
          „Opublikuj”.
        </p>
      ) : null}
      <textarea
        className="ui-textarea op-reply-field"
        value={text}
        rows={Math.min(10, Math.max(4, Math.ceil(text.length / 80)))}
        aria-label="Treść odpowiedzi"
        disabled={pending}
        onChange={(event) => setText(event.target.value)}
        onBlur={saveOnBlur}
      />
      {item.rating !== null && item.rating <= 2 && !editingPublished ? (
        <p className="op-reply-rule">
          <ShieldCheck aria-hidden />
          Ocena 1-2: odpowiedź nie przyznaje się do winy i zaprasza do kontaktu
          poza Google. Publikujesz zawsze Ty.
        </p>
      ) : null}
      {item.draftStatus === "failed" ? (
        <p className="op-reply-hint">
          Ostatnie generowanie nie powiodło się - możesz poprawić szkic ręcznie
          albo wygenerować go ponownie.
        </p>
      ) : null}
      {item.draftOutdated ? (
        <p className="op-reply-hint is-error">
          Opinia zmieniła się po napisaniu szkicu - sprawdź przed publikacją.
        </p>
      ) : null}
      {item.publishStatus === "failed" && item.publishError ? (
        <p className="op-reply-hint is-error">
          Nie opublikowano: {item.publishError}
        </p>
      ) : null}
      <div className="op-reply-foot">
        <div className="op-actions is-start">
          <button
            type="button"
            className="ui-btn ui-btn-ghost ui-btn-sm op-muted-btn"
            disabled={pending}
            onClick={discard}
          >
            {editingPublished ? "Anuluj edycję" : "Odrzuć szkic"}
          </button>
          {editingPublished ? null : (
            <ReasonPopover
              pending={pending}
              onConfirm={regenerate}
              copy={REGENERATE_COPY}
              closeOnConfirm
            />
          )}
        </div>
        <button
          type="button"
          className="ui-btn ui-btn-primary ui-btn-sm"
          disabled={pending || over || !text.trim()}
          onClick={publish}
        >
          {pending ? (
            <Loader2 aria-hidden className="ui-btn-spinner" />
          ) : (
            <Send aria-hidden />
          )}
          Opublikuj
        </button>
      </div>
    </div>
  );
}
