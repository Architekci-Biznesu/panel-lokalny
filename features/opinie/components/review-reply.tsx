"use client";

import { Check, Loader2, Pencil, Sparkles, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "gooey-toast";
import {
  deleteReviewReplyAction,
  requestReviewDraft,
  startEditingReviewReply,
} from "@/features/opinie/actions";
import type { ReviewItem } from "@/features/opinie/load-reviews";
import { ReplyEditor } from "@/features/opinie/components/reply-editor";

const DATE_FMT = new Intl.DateTimeFormat("pl-PL", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Europe/Warsaw",
});

/** The reply area of a card: draft, published reply, or nothing yet. */
export function ReviewReply({ item }: { item: ReviewItem }) {
  if (item.draftText !== null || item.draftStatus === "generating") {
    // key: a regenerated draft replaces what the editor shows
    return <ReplyEditor key={item.draftText ?? "generating"} item={item} />;
  }
  if (item.replyText !== null) return <PublishedReply item={item} />;
  return <NoReply item={item} />;
}

function PublishedReply({ item }: { item: ReviewItem }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  const when = item.repliedAt
    ? DATE_FMT.format(new Date(item.repliedAt))
    : null;
  const source =
    item.replySource === "external" ? "dodana w Google" : "z panelu";

  function edit() {
    startTransition(async () => {
      const result = await startEditingReviewReply({ reviewId: item.id });
      if (!result.ok) {
        toast.error({ title: "Nie można edytować", description: result.error });
        return;
      }
      router.refresh();
    });
  }

  function remove() {
    startTransition(async () => {
      const result = await deleteReviewReplyAction({ reviewId: item.id });
      if (!result.ok) {
        toast.error({
          title: "Nie usunięto odpowiedzi",
          description: result.error,
        });
        setConfirming(false);
        return;
      }
      toast.success({ title: "Odpowiedź usunięta w Google" });
      router.refresh();
    });
  }

  return (
    <div className="op-reply is-published">
      <div className="op-reply-top">
        <p className="op-reply-label">
          <Check aria-hidden />
          Odpowiedź opublikowana
        </p>
        <span className="op-reply-meta">
          {when ? <span className="mono">{when}</span> : null}
          {when ? " · " : null}
          {source}
        </span>
      </div>
      <p className="op-reply-text is-quote">{item.replyText}</p>
      <div className="op-reply-foot">
        {confirming ? (
          <>
            <span className="op-confirm-text">
              Usunąć odpowiedź w Google? Opinia wróci do „Do odpowiedzi”.
            </span>
            <div className="op-actions">
              <button
                type="button"
                className="ui-btn ui-btn-ghost ui-btn-sm"
                disabled={pending}
                onClick={() => setConfirming(false)}
              >
                Anuluj
              </button>
              <button
                type="button"
                className="ui-btn ui-btn-danger ui-btn-sm"
                disabled={pending}
                onClick={remove}
              >
                {pending ? (
                  <Loader2 aria-hidden className="ui-btn-spinner" />
                ) : (
                  <Trash2 aria-hidden />
                )}
                Usuń odpowiedź
              </button>
            </div>
          </>
        ) : (
          <div className="op-actions">
            <button
              type="button"
              className="ui-btn ui-btn-ghost ui-btn-sm"
              disabled={pending}
              onClick={edit}
            >
              <Pencil aria-hidden />
              Edytuj
            </button>
            <button
              type="button"
              className="ui-btn ui-btn-ghost ui-btn-sm"
              disabled={pending}
              onClick={() => setConfirming(true)}
            >
              <Trash2 aria-hidden />
              Usuń odpowiedź
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function NoReply({ item }: { item: ReviewItem }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function propose() {
    startTransition(async () => {
      const result = await requestReviewDraft({ reviewId: item.id });
      if (!result.ok) {
        toast.error({
          title: "AI nie napisało odpowiedzi",
          description: result.error,
        });
      }
      router.refresh();
    });
  }

  if (pending) {
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
        <span className="ui-skel" style={{ width: "70%", height: "0.75rem" }} />
      </div>
    );
  }

  return (
    <div className="op-reply is-empty">
      <p className="op-reply-hint">
        {item.draftStatus === "failed"
          ? "Nie udało się napisać odpowiedzi."
          : "Ta opinia nie ma jeszcze odpowiedzi."}
      </p>
      {item.publishStatus === "failed" && item.publishError ? (
        <p className="op-reply-hint is-error">
          Nie opublikowano: {item.publishError}
        </p>
      ) : null}
      <button
        type="button"
        className="ui-btn ui-btn-outline ui-btn-sm"
        onClick={propose}
      >
        <Sparkles aria-hidden />
        {item.draftStatus === "failed"
          ? "Spróbuj ponownie"
          : "Zaproponuj odpowiedź"}
      </button>
    </div>
  );
}
