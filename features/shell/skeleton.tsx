import type { ModuleTab } from "@/features/shell/module-tabs";

/**
 * Loading skeleton building blocks - one set for the whole app.
 * Rules: static text (titles, tab names, column headings) is real, data is a
 * grey bar, containers use the same classes as the loaded page, and blocks
 * whose height depends on data get the loaded element's minHeight.
 */

/** Grey bar (.ui-skel). */
export function Skel({
  w,
  h = "0.75rem",
  block = false,
  style,
}: {
  w: string | number;
  h?: string | number;
  /** Block radius for images and charts instead of a pill. */
  block?: boolean;
  style?: React.CSSProperties;
}) {
  return (
    <span
      className={block ? "ui-skel ui-skel-block" : "ui-skel"}
      style={{ width: w, height: h, ...style }}
    />
  );
}

/** Grey pill the size of a button. */
export function SkelButton({
  w,
  small = false,
  h,
}: {
  w: string;
  small?: boolean;
  /** Only where a module overrides the button height (e.g. 40 px in Wizytówka's header). */
  h?: number;
}) {
  return (
    <span
      className="ui-skel"
      style={{
        width: w,
        height: h ?? (small ? "var(--btn-height-sm)" : "var(--btn-height)"),
        flexShrink: 0,
      }}
    />
  );
}

/** Round grey avatar or icon. */
export function SkelCircle({ size = 40 }: { size?: number }) {
  return (
    <span
      className="ui-skel ui-skel-circle"
      style={{ width: size, height: size }}
    />
  );
}

/** The module's tabs with real names; the first one is active. */
export function SkelSubnav({ tabs }: { tabs: readonly ModuleTab[] }) {
  return (
    <nav className="ui-subnav" aria-hidden>
      {tabs.map((tab, index) => (
        <span
          key={tab.href}
          className={`ui-subnav-link ${index === 0 ? "active" : ""}`}
        >
          <span>{tab.label}</span>
        </span>
      ))}
    </nav>
  );
}

/**
 * Grey bar inside a line of text (e.g. a <p> that will hold a date). Inline,
 * so the line keeps its real line-height and the block does not jump.
 */
export function SkelText({ w, h = "0.75rem" }: { w: string; h?: string }) {
  return (
    <span
      className="ui-skel"
      style={{
        display: "inline-block",
        verticalAlign: "middle",
        width: w,
        height: h,
      }}
    />
  );
}
