"use client";

import { ImageIcon, ImagePlus, Loader2, Sparkles, Trash2 } from "lucide-react";
import { useRef } from "react";
import { toast } from "gooey-toast";

const MAX_BYTES = 8 * 1024 * 1024;
const ACCEPT = "image/jpeg,image/png,image/webp";

/** Quick check in the browser; the server validates the file again. */
function acceptable(file: File): string | null {
  if (!/^image\/(jpeg|jpg|png|webp)$/i.test(file.type)) {
    return "Dozwolone są zdjęcia JPG, PNG i WEBP";
  }
  if (file.size > MAX_BYTES) return "Zdjęcie jest za duże (maks. 8 MB)";
  return null;
}

/**
 * Post image area: shows the photo with "Podmień" / "Usuń", or an empty state
 * with "Wgraj zdjęcie" (and optionally "Wygeneruj AI").
 */
export function PostImagePicker({
  previewUrl,
  disabled,
  busy,
  onPick,
  onRemove,
  onGenerate,
  generating,
}: {
  previewUrl: string | null;
  disabled?: boolean;
  /** Upload in progress - spinner over the image */
  busy?: boolean;
  onPick: (file: File) => void;
  onRemove: () => void;
  onGenerate?: () => void;
  generating?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  function choose() {
    inputRef.current?.click();
  }

  const input = (
    <input
      ref={inputRef}
      type="file"
      accept={ACCEPT}
      hidden
      onChange={(event) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file) return;
        const problem = acceptable(file);
        if (problem) {
          toast.error({ title: problem });
          return;
        }
        onPick(file);
      }}
    />
  );

  if (previewUrl) {
    return (
      <div className="pub-image">
        {input}
        {/* eslint-disable-next-line @next/next/no-img-element -- R2 / local preview URL */}
        <img src={previewUrl} alt="" className="pub-image-img" />
        {busy ? (
          <span className="pub-image-busy" aria-label="Wgrywam zdjęcie">
            <Loader2 aria-hidden />
          </span>
        ) : null}
        <div className="pub-image-actions">
          <button
            type="button"
            className="ui-btn ui-btn-white ui-btn-sm"
            disabled={disabled || busy}
            onClick={choose}
          >
            <ImagePlus aria-hidden />
            Podmień
          </button>
          <button
            type="button"
            className="ui-btn ui-btn-white ui-btn-sm"
            disabled={disabled || busy}
            onClick={onRemove}
            aria-label="Usuń zdjęcie"
          >
            <Trash2 aria-hidden />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="pub-card-placeholder">
      {input}
      {busy ? <Loader2 aria-hidden /> : <ImageIcon aria-hidden />}
      <p>{busy ? "Wgrywam zdjęcie…" : "Post bez grafiki"}</p>
      <div className="pub-image-empty-actions">
        <button
          type="button"
          className="ui-btn ui-btn-white ui-btn-sm"
          disabled={disabled || busy}
          onClick={choose}
        >
          <ImagePlus aria-hidden />
          Wgraj zdjęcie
        </button>
        {onGenerate ? (
          <button
            type="button"
            className="ui-btn ui-btn-white ui-btn-sm"
            disabled={disabled || busy}
            onClick={onGenerate}
          >
            {generating ? (
              <Loader2 aria-hidden className="ui-btn-spinner" />
            ) : (
              <Sparkles aria-hidden />
            )}
            {generating ? "Tworzę…" : "Wygeneruj AI"}
          </button>
        ) : null}
      </div>
    </div>
  );
}
