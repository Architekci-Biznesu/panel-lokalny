"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";

const GAP = 8;

/**
 * A panel anchored to its trigger button: rendered in a portal with fixed
 * position (no clipping by card overflow), right edge under the trigger with
 * 16 px from the screen edges, opening upwards when there is no room below.
 * Closes on a click outside; follows scroll and resize. Spread `panelProps`
 * on the panel: clicks in menus portaled from inside it (date and time
 * pickers) reach it through React and do not count as outside.
 */
export function useAnchoredPopover<
  TTrigger extends HTMLElement = HTMLButtonElement,
>() {
  const [open, setOpen] = useState(false);
  const [style, setStyle] = useState<CSSProperties>({ visibility: "hidden" });
  const triggerRef = useRef<TTrigger>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  // Set by the panel's React mousedown (also from its portaled children),
  // read by the document listener that runs right after it.
  const insideRef = useRef(false);

  const place = useCallback(() => {
    const trigger = triggerRef.current;
    const panel = panelRef.current;
    if (!trigger || !panel) return;
    const rect = trigger.getBoundingClientRect();
    const height = panel.offsetHeight;
    const below = window.innerHeight - rect.bottom;
    const openUp = below < height + GAP * 2 && rect.top > below;
    setStyle({
      right: Math.min(
        Math.max(GAP * 2, window.innerWidth - rect.right),
        window.innerWidth - panel.offsetWidth - GAP * 2,
      ),
      top: openUp ? rect.top - height - GAP : rect.bottom + GAP,
      transformOrigin: openUp ? "bottom right" : "top right",
    });
  }, []);

  useLayoutEffect(() => {
    if (open) place();
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    function onDown(event: MouseEvent) {
      const target = event.target as Node;
      if (insideRef.current) {
        insideRef.current = false;
        return;
      }
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

  /** Close and give focus back to the trigger. */
  const close = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  const panelProps = {
    onMouseDown: () => {
      insideRef.current = true;
    },
  };

  return { open, setOpen, close, style, triggerRef, panelRef, panelProps };
}
