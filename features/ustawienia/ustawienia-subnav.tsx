"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/ustawienia/kontekst", label: "Kontekst firmy" },
  { href: "/ustawienia/profile", label: "Profile" },
  { href: "/ustawienia/integracje", label: "Integracje" },
  { href: "/ustawienia/zespol", label: "Zespół" },
  { href: "/ustawienia/plan", label: "Plan i rozliczenia" },
] as const;

export function UstawieniaSubnav() {
  const pathname = usePathname();

  return (
    <nav className="ui-subnav" aria-label="Zakładki ustawień">
      {tabs.map((tab) => {
        const active =
          pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`ui-subnav-link ${active ? "active" : ""}`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
