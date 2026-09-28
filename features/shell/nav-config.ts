import {
  Building2,
  FileText,
  LayoutDashboard,
  MessageSquare,
  Send,
  ShoppingBag,
  Users,
  Globe,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  /** Krótsza etykieta w górnym navbarze (styl 4). */
  shortLabel?: string;
  icon: LucideIcon;
  /**
   * Prefiks ścieżki do podświetlenia w navbarze.
   * Gdy href wskazuje na konkretną zakładkę (np. /wizytowka/raporty),
   * activeMatch trzyma aktywny stan na całym module (/wizytowka/*).
   */
  activeMatch?: string;
};

export type NavGroup = {
  label: string;
  items: NavItem[];
};

export const navGroups: NavGroup[] = [
  {
    label: "Ogólne",
    items: [{ href: "/pulpit", label: "Pulpit", icon: LayoutDashboard }],
  },
  {
    label: "Obecność online",
    items: [
      { href: "/strona", label: "Strona WWW", icon: Globe },
      {
        href: "/wizytowka/raporty",
        label: "Wizytówka Google",
        shortLabel: "Wizytówka",
        icon: Building2,
        activeMatch: "/wizytowka",
      },
      { href: "/publikacje", label: "Publikacje", icon: FileText },
      {
        href: "/opinie",
        label: "Opinie i komentarze",
        shortLabel: "Opinie",
        icon: MessageSquare,
      },
    ],
  },
  {
    label: "Sprzedaż",
    items: [
      {
        href: "/crm",
        label: "Klienci (CRM)",
        shortLabel: "Klienci",
        icon: Users,
      },
      {
        href: "/kampanie-wysylkowe",
        label: "Kampanie wysyłkowe",
        shortLabel: "Kampanie",
        icon: Send,
      },
    ],
  },
  {
    label: "Rozwój",
    items: [{ href: "/sklep", label: "Sklep i dodatki", icon: ShoppingBag }],
  },
];

const allItems = navGroups.flatMap((group) => group.items);
const byHref = (href: string) => allItems.find((item) => item.href === href)!;

/** Górny navbar (styl 4): pozycje w pasku. Ustawienia tylko z menu awatara. */
export const topNavPrimary: NavItem[] = [
  "/pulpit",
  "/wizytowka/raporty",
  "/publikacje",
  "/opinie",
  "/crm",
  "/kampanie-wysylkowe",
  "/strona",
  "/sklep",
].map(byHref);

export const topNavMore: NavItem[] = [];
