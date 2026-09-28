"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export const PUB_TABS = [
  { href: "/publikacje", label: "Przegląd", exact: true },
  { href: "/publikacje/inbox", label: "Do akceptacji", exact: false },
  { href: "/publikacje/nowy", label: "Nowa publikacja", exact: false },
  { href: "/publikacje/wszystkie", label: "Wszystkie", exact: false },
  { href: "/publikacje/kalendarz", label: "Kalendarz", exact: false },
] as const;

/** Module tabs - the same .ui-subnav pattern as Wizytówka. */
export function PublikacjeSubnav({ pendingCount }: { pendingCount: number }) {
  const pathname = usePathname();

  return (
    <nav className="ui-subnav" aria-label="Zakładki publikacji">
      {PUB_TABS.map((tab) => {
        const active = tab.exact
          ? pathname === tab.href
          : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        const count = tab.href === "/publikacje/inbox" ? pendingCount : 0;
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
                aria-label={`${count} do akceptacji`}
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
