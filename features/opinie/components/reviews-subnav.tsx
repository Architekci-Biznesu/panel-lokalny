"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/opinie", label: "Opinie", exact: true },
  { href: "/opinie/ustawienia", label: "Ustawienia odpowiedzi", exact: false },
] as const;

/** Module tabs - the same .ui-subnav pattern as Publikacje. */
export function ReviewsSubnav({ pendingCount }: { pendingCount: number }) {
  const pathname = usePathname();

  return (
    <nav className="ui-subnav" aria-label="Zakładki opinii">
      {TABS.map((tab) => {
        const active = tab.exact
          ? pathname === tab.href
          : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        const count = tab.exact ? pendingCount : 0;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`ui-subnav-link ${active ? "active" : ""}`}
          >
            <span>{tab.label}</span>
            {count > 0 ? (
              <span
                className="ui-subnav-badge"
                aria-label={`${count} do odpowiedzi`}
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
