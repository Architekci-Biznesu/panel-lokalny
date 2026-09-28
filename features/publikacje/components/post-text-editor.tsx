"use client";

import { Loader2, Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "gooey-toast";
import { updatePostText } from "@/features/publikacje/actions";
import {
  MANUAL_BODY_MAX,
  MANUAL_TITLE_MAX,
} from "@/features/publikacje/manual-post-rules";

/**
 * Title and text of a proposal, editable in place: click (or the pencil) to
 * edit, Enter / "Zapisz" saves, Esc / "Anuluj" cancels. Every save goes to the
 * post history, so "Cofnij" in the chat works for manual edits too.
 */
export function PostTextEditor({
  item,
  disabled,
}: {
  item: { id: string; title: string; body: string };
  disabled?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<"title" | "body" | null>(null);
  const [title, setTitle] = useState(item.title);
  const [body, setBody] = useState(item.body);

  function open(part: "title" | "body") {
    if (disabled || pending) return;
    setTitle(item.title);
    setBody(item.body);
    setEditing(part);
  }

  function cancel() {
    setEditing(null);
  }

  function save() {
    startTransition(async () => {
      const result = await updatePostText({ itemId: item.id, title, body });
      if (!result.ok) {
        toast.error({ title: "Nie zapisano", description: result.error });
        return;
      }
      setEditing(null);
      if (result.title !== item.title || result.body !== item.body) {
        toast.success({ title: "Zapisano zmianę posta" });
        router.refresh();
      }
    });
  }

  const actions = (
    <div className="pub-inline-actions">
      <button
        type="button"
        className="ui-btn ui-btn-ghost ui-btn-sm"
        onClick={cancel}
        disabled={pending}
      >
        Anuluj
      </button>
      <button
        type="button"
        className="ui-btn ui-btn-primary ui-btn-sm"
        onClick={save}
        disabled={pending}
      >
        {pending ? <Loader2 aria-hidden className="ui-btn-spinner" /> : null}
        Zapisz
      </button>
    </div>
  );

  return (
    <>
      {editing === "title" ? (
        <div className="pub-inline">
          <input
            className="ui-field pub-inline-title"
            value={title}
            maxLength={MANUAL_TITLE_MAX}
            aria-label="Tytuł posta"
            autoFocus
            disabled={pending}
            onChange={(event) => setTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                save();
              }
              if (event.key === "Escape") cancel();
            }}
          />
          {actions}
        </div>
      ) : (
        <h3 className="pub-card-title pub-editable">
          <button
            type="button"
            className="pub-editable-trigger"
            onClick={() => open("title")}
            disabled={disabled}
            aria-label={`Edytuj tytuł: ${item.title}`}
          >
            {item.title}
            <Pencil aria-hidden className="pub-editable-icon" />
          </button>
        </h3>
      )}

      {editing === "body" ? (
        <div className="pub-inline">
          <textarea
            className="ui-textarea pub-inline-body"
            value={body}
            rows={Math.min(14, Math.max(5, Math.ceil(body.length / 90)))}
            aria-label="Treść posta"
            autoFocus
            disabled={pending}
            onChange={(event) => setBody(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") cancel();
            }}
          />
          <div className="pub-inline-foot">
            <span
              className={`pub-counter mono${body.length > MANUAL_BODY_MAX ? " is-over" : ""}`}
            >
              {body.length} / {MANUAL_BODY_MAX}
            </span>
            {actions}
          </div>
        </div>
      ) : (
        <div className="pub-editable">
          <button
            type="button"
            className="pub-editable-trigger pub-card-body"
            onClick={() => open("body")}
            disabled={disabled}
            aria-label="Edytuj treść posta"
          >
            {item.body}
            <Pencil aria-hidden className="pub-editable-icon" />
          </button>
        </div>
      )}
    </>
  );
}
