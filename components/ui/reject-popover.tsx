"use client";

import { Loader2, X } from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";

/** Gotowe powody - klik wpisuje tekst do pola, można go dalej edytować. */
const QUICK_REASONS = [
  "Nie pasuje do firmy",
  "Nieprawdziwe informacje",
  "Wolę obecną wersję",
] as const;

const GAP = 8;

/**
 * Przycisk "Odrzuć" z dropdownem: opcjonalny powód (trafia do "czego unikać")
 * i potwierdzenie. Panel jest w portalu z pozycją fixed, więc nie ucina go
 * overflow kafla z polami; otwiera się w górę, gdy pod przyciskiem brakuje miejsca.
 */
export function RejectPopover({
  pending,
  onConfirm,
}: {
  pending: boolean;
  onConfirm: (reason: string | undefined) => void;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [style, setStyle] = useState<CSSProperties>({ visibility: "hidden" });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fieldId = useId();

  const place = useCallback(() => {
    const trigger = triggerRef.current;
    const panel = panelRef.current;
    if (!trigger || !panel) return;
    const rect = trigger.getBoundingClientRect();
    const height = panel.offsetHeight;
    const below = window.innerHeight - rect.bottom;
    const openUp = below < height + GAP * 2 && rect.top > below;
    setStyle({
      // Prawa krawędź pod przyciskiem, ale min. 16 px marginesu z obu stron ekranu.
      right: Math.min(
        Math.max(GAP * 2, window.innerWidth - rect.right),
        window.innerWidth - panel.offsetWidth - GAP * 2,
      ),
      top: openUp ? rect.top - height - GAP : rect.bottom + GAP,
      transformOrigin: openUp ? "bottom right" : "top right",
    });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    place();
    textareaRef.current?.focus();
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    function onDown(event: MouseEvent) {
      const target = event.target as Node;
      if (
        panelRef.current?.contains(target) ||
        triggerRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    }
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    document.addEventListener("mousedown", onDown);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open, place]);

  function close() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  function confirm() {
    onConfirm(reason.trim() || undefined);
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="ui-btn ui-btn-soft-danger ui-btn-sm"
        disabled={pending}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <X aria-hidden />
        Odrzuć
      </button>

      {open
        ? createPortal(
            <div
              ref={panelRef}
              className="ui-reject-pop"
              role="dialog"
              aria-label="Odrzuć propozycję"
              style={style}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  close();
                }
                if (
                  event.key === "Enter" &&
                  (event.metaKey || event.ctrlKey) &&
                  !pending
                ) {
                  event.preventDefault();
                  confirm();
                }
              }}
            >
              <div className="ui-reject-pop-head">
                <p className="ui-reject-pop-title">Odrzucić propozycję?</p>
                <p className="ui-reject-pop-desc">
                  Powód jest opcjonalny - dopiszemy go do „czego unikać” w
                  kontekście, żeby AI nie proponowało tego ponownie.
                </p>
              </div>

              <div className="ui-reject-pop-chips">
                {QUICK_REASONS.map((item) => (
                  <button
                    key={item}
                    type="button"
                    className={`ui-reject-pop-chip${reason === item ? " is-active" : ""}`}
                    onClick={() => {
                      setReason(item);
                      textareaRef.current?.focus();
                    }}
                  >
                    {item}
                  </button>
                ))}
              </div>

              <label className="sr-only" htmlFor={fieldId}>
                Dlaczego odrzucasz?
              </label>
              <textarea
                ref={textareaRef}
                id={fieldId}
                className="ui-textarea ui-reject-pop-field"
                rows={3}
                placeholder="Np. nie oferujemy wymiany oleju"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />

              <div className="ui-reject-pop-foot">
                <button
                  type="button"
                  className="ui-btn ui-btn-ghost ui-btn-sm"
                  onClick={close}
                >
                  Anuluj
                </button>
                <button
                  type="button"
                  className="ui-btn ui-btn-danger ui-btn-sm"
                  disabled={pending}
                  onClick={confirm}
                >
                  {pending ? (
                    <Loader2 aria-hidden className="ui-btn-spinner" />
                  ) : (
                    <X aria-hidden />
                  )}
                  Odrzuć propozycję
                </button>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
