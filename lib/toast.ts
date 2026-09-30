import { toast as gooey, type ToastOptions } from "gooey-toast";

/**
 * gooey-toast with Panel Lokalny icons: no icons in circles, a triangle for
 * warnings, a plain "i" for info and ✦ for AI work (toast.ai). Colors come
 * from the --gooey-state-* tokens. Use this instead of importing gooey-toast.
 */

const SVG_NS = "http://www.w3.org/2000/svg";

// Lucide paths (24x24, stroke). Built lazily - toasts render only in the browser.
const PATHS = {
  warning: [
    "m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3",
    "M12 9v4",
    "M12 17h.01",
  ],
  info: ["M12 19v-8", "M10 11h2", "M12 5.5h.01"],
  ai: [
    "M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z",
    "M20 3v4",
    "M22 5h-4",
    "M4 17v2",
    "M5 18H3",
  ],
} as const;

const STROKE: Record<keyof typeof PATHS, string> = {
  warning: "2",
  info: "2.75",
  ai: "2",
};

function icon(name: keyof typeof PATHS): () => SVGSVGElement {
  return () => {
    const svg = document.createElementNS(SVG_NS, "svg");
    for (const [key, value] of Object.entries({
      width: "16",
      height: "16",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      "stroke-width": STROKE[name],
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
      "aria-hidden": "true",
    })) {
      svg.setAttribute(key, value);
    }
    for (const d of PATHS[name]) {
      const path = document.createElementNS(SVG_NS, "path");
      path.setAttribute("d", d);
      svg.append(path);
    }
    return svg;
  };
}

const withIcon =
  (show: (opts: ToastOptions) => string, name: keyof typeof PATHS) =>
  (opts: ToastOptions) =>
    show({ icon: icon(name), ...opts });

export const toast = {
  ...gooey,
  warning: withIcon(gooey.warning, "warning"),
  info: withIcon(gooey.info, "info"),
  /** AI started working on something ("AI pisze 2 posty"). */
  ai: withIcon(gooey.info, "ai"),
};
