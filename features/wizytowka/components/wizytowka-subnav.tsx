"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { WIZ_TABS, type WizTabHref } from "@/features/wizytowka/proposal-meta";

export function WizytowkaSubnav({
  counts = {},
}: {
  counts?: Partial<Record<WizTabHref, number>>;
}) {
  const pathname = usePathname();

  return (
    <nav className="ui-subnav" aria-label="Zakładki wizytówki">
      {WIZ_TABS.map((tab) => {
        const active =
          pathname === tab.href || pathname.startsWith(`${tab.href}/`);
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
                aria-label={`${count} propozycji`}
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
