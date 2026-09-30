"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import type { ModuleTab } from "@/features/shell/module-tabs";

/**
 * Module tabs (.ui-subnav) - one component for every module. A clicked tab
 * shows a pulsing dot while its page loads; there is no skeleton on tab change.
 */
export function ModuleSubnav({
  tabs,
  label,
  counts = {},
  countLabel = "",
}: {
  tabs: readonly ModuleTab[];
  /** aria-label of the nav, e.g. "Zakładki opinii". */
  label: string;
  counts?: Partial<Record<string, number>>;
  /** Badge text after the number, e.g. "do odpowiedzi". */
  countLabel?: string;
}) {
  const pathname = usePathname();

  return (
    <nav className="ui-subnav" aria-label={label}>
      {tabs.map((tab) => {
        const active = tab.exact
          ? pathname === tab.href
          : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        const count = counts[tab.href] ?? 0;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`ui-subnav-link ${active ? "active" : ""}`}
          >
            <span>{tab.label}</span>
            <PendingDot />
            {count > 0 ? (
              <span
                className="ui-subnav-badge"
                aria-label={`${count} ${countLabel}`.trim()}
              >
                {count}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

/** Clicked tab waits for the server - a small pulsing dot shows the click worked. */
function PendingDot() {
  const { pending } = useLinkStatus();
  return pending ? <span className="ui-subnav-pending" aria-hidden /> : null;
}
