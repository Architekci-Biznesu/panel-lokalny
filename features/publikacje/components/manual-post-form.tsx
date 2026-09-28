"use client";

import { Check, Loader2, SquarePen, X } from "lucide-react";
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
    <section className="pub-panel" aria-labelledby="pub-manual-title">
      <header className="pub-panel-head">
        <span className="pub-panel-icon is-neutral" aria-hidden>
          <SquarePen />
        </span>
        <div className="pub-panel-titles">
          <h2 id="pub-manual-title" className="pub-panel-title">
            Nowy post
          </h2>
          <p className="pub-panel-sub">
            Własna treść i zdjęcie - trafi na listę jako „Twój post” i przejdzie
            tę samą akceptację
          </p>
        </div>
        <button
          type="button"
          className="ui-btn ui-btn-ghost ui-btn-sm pub-panel-close"
          aria-label="Zamknij"
          onClick={onClose}
          disabled={pending}
        >
          <X aria-hidden />
        </button>
      </header>

      <form
        id="pub-manual-form"
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
          <label className="pub-manual-label" htmlFor="pub-manual-title-field">
            Tytuł
          </label>
          <input
            ref={titleRef}
            id="pub-manual-title-field"
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
            rows={6}
            value={body}
            placeholder="Wklej albo napisz treść posta"
            disabled={pending}
            onChange={(event) => setBody(event.target.value)}
          />
        </div>
      </form>

      <footer className="pub-panel-foot">
        <span className="pub-panel-note">
          Gdzie i kiedy wybierzesz na karcie, przy akceptacji
        </span>
        <div className="pub-panel-actions">
          <button
            type="button"
            className="ui-btn ui-btn-secondary"
            onClick={onClose}
            disabled={pending}
          >
            Anuluj
          </button>
          <button
            type="submit"
            form="pub-manual-form"
            className="ui-btn ui-btn-primary"
            disabled={pending}
          >
            {pending ? (
              <Loader2 aria-hidden className="ui-btn-spinner" />
            ) : (
              <Check aria-hidden />
            )}
            Dodaj do listy
          </button>
        </div>
      </footer>
    </section>
  );
}
