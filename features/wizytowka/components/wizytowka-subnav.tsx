"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/wizytowka/informacje", label: "Informacje" },
  { href: "/wizytowka/kontakt", label: "Kontakt" },
  { href: "/wizytowka/godziny", label: "Godziny i atrybuty" },
  { href: "/wizytowka/nap", label: "NAP" },
  { href: "/wizytowka/raporty", label: "Raporty" },
] as const;

export function WizytowkaSubnav() {
  const pathname = usePathname();

  return (
    <nav className="wiz-subnav" aria-label="Zakładki wizytówki">
      {tabs.map((tab) => {
        const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`wiz-subnav-link ${active ? "active" : ""}`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
