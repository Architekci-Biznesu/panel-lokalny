"use client";

import { ImagePlus, Loader2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "gooey-toast";
import { createManualPost } from "@/features/publikacje/actions";
import {
  checkManualPost,
  MANUAL_BODY_MAX,
  MANUAL_TITLE_MAX,
} from "@/features/publikacje/manual-post-rules";
import { PostImagePicker } from "@/features/publikacje/components/post-image-picker";

/** Customer's own post: title, pasted text and an optional own photo. */
export function ManualPostForm({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  const preview = useMemo(
    () => (image ? URL.createObjectURL(image) : null),
    [image],
  );
  useEffect(() => {
    titleRef.current?.focus();
  }, []);
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  function submit() {
    const check = checkManualPost({ title, body });
    if (!check.ok) {
      toast.error({ title: check.error });
      return;
    }
    const data = new FormData();
    data.set("title", check.title);
    data.set("body", check.body);
    if (image) data.set("image", image);

    startTransition(async () => {
      const result = await createManualPost(data);
      if (!result.ok) {
        toast.error({ title: "Nie dodano posta", description: result.error });
        return;
      }
      toast.success({ title: "Post dodany do listy" });
      onClose();
      router.refresh();
    });
  }

  return (
    <section className="ui-section pub-manual" aria-label="Nowy post">
      <header className="pub-manual-head">
        <h2 className="pub-manual-title">Nowy post</h2>
        <button
          type="button"
          className="ui-btn ui-btn-ghost ui-btn-sm"
          aria-label="Zamknij"
          onClick={onClose}
          disabled={pending}
        >
          <X aria-hidden />
        </button>
      </header>

      <form
        className="pub-manual-form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <div className="pub-manual-media">
          <PostImagePicker
            previewUrl={preview}
            disabled={pending}
            onPick={setImage}
            onRemove={() => setImage(null)}
          />
        </div>

        <div className="pub-manual-fields">
          <label className="pub-manual-label" htmlFor="pub-manual-title">
            Tytuł
          </label>
          <input
            ref={titleRef}
            id="pub-manual-title"
            className="ui-field"
            value={title}
            maxLength={MANUAL_TITLE_MAX}
            placeholder="O czym jest post"
            disabled={pending}
            onChange={(event) => setTitle(event.target.value)}
          />

          <div className="pub-manual-label-row">
            <label className="pub-manual-label" htmlFor="pub-manual-body">
              Treść
            </label>
            <span
              className={`pub-counter mono${body.length > MANUAL_BODY_MAX ? " is-over" : ""}`}
            >
              {body.length} / {MANUAL_BODY_MAX}
            </span>
          </div>
          <textarea
            id="pub-manual-body"
            className="ui-textarea pub-manual-body"
            rows={8}
            value={body}
            placeholder="Wklej albo napisz treść posta"
            disabled={pending}
            onChange={(event) => setBody(event.target.value)}
          />

          <div className="pub-manual-actions">
            <button
              type="button"
              className="ui-btn ui-btn-white"
              onClick={onClose}
              disabled={pending}
            >
              Anuluj
            </button>
            <button
              type="submit"
              className="ui-btn ui-btn-primary"
              disabled={pending}
            >
              {pending ? (
                <Loader2 aria-hidden className="ui-btn-spinner" />
              ) : (
                <ImagePlus aria-hidden />
              )}
              Dodaj do listy
            </button>
          </div>
        </div>
      </form>
    </section>
  );
}
