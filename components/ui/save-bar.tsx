"use client";

import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";

/**
 * The one "unsaved changes" bar: a floating dark pill at the bottom of the
 * screen. The caller decides WHEN it shows (usually only while there are
 * changes). It also renders an in-flow spacer, so it never covers the end of
 * the page.
 *
 * Save is a submit button unless `onSave` is given (forms just use submit).
 */
export function SaveBar({
  message,
  leading,
  undoLabel = "Cofnij",
  onUndo,
  saveLabel = "Zapisz",
  onSave,
  pending = false,
  saveDisabled = false,
}: {
  /** Status text ("Niezapisane zmiany"); omit for a bar without it */
  message?: string;
  /** Own controls on the left (e.g. adding services) */
  leading?: ReactNode;
  undoLabel?: string;
  onUndo: () => void;
  saveLabel?: string;
  onSave?: () => void;
  pending?: boolean;
  /** Save is off (e.g. nothing changed yet) */
  saveDisabled?: boolean;
}) {
  return (
    <>
      <div className="ui-savebar-space" aria-hidden />
      <div className="ui-savebar" role="status">
        {leading ? <div className="ui-savebar-lead">{leading}</div> : null}
        {message ? (
          <span className="ui-savebar-text">
            <span className="ui-savebar-dot" aria-hidden />
            {message}
          </span>
        ) : null}
        <button
          type="button"
          className="ui-savebar-undo"
          disabled={pending}
          onClick={onUndo}
        >
          {undoLabel}
        </button>
        <button
          type={onSave ? "button" : "submit"}
          className="ui-savebar-save"
          disabled={pending || saveDisabled}
          onClick={onSave}
        >
          {pending ? <Loader2 aria-hidden className="ui-btn-spinner" /> : null}
          {saveLabel}
        </button>
      </div>
    </>
  );
}
