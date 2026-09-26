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
        href: "/wizytowka",
        label: "Wizytówka Google",
        shortLabel: "Wizytówka",
        icon: Building2,
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
  "/wizytowka",
  "/publikacje",
  "/opinie",
  "/crm",
  "/kampanie-wysylkowe",
  "/strona",
  "/sklep",
].map(byHref);

export const topNavMore: NavItem[] = [];

/** All leaf routes that need a placeholder page in phase 1 */
export const placeholderRoutes: { href: string; title: string }[] = [
  { href: "/pulpit", title: "Pulpit" },
  { href: "/strona/tresci", title: "Treści strony" },
  { href: "/strona/backlinki", title: "Backlinki" },
  { href: "/strona/analityka", title: "Analityka strony" },
  { href: "/wizytowka/informacje", title: "Informacje o firmie" },
  { href: "/wizytowka/kontakt", title: "Kontakt" },
  { href: "/wizytowka/atrybuty", title: "Atrybuty" },
  { href: "/wizytowka/nap", title: "NAP i katalogi" },
  { href: "/wizytowka/raporty", title: "Raporty wizytówki" },
  { href: "/publikacje/inbox", title: "Do akceptacji" },
  { href: "/publikacje/wszystkie", title: "Wszystkie publikacje" },
  { href: "/publikacje/kalendarz", title: "Kalendarz publikacji" },
  { href: "/publikacje/nowy", title: "Nowa publikacja" },
  { href: "/opinie", title: "Opinie i komentarze" },
  { href: "/opinie/ustawienia", title: "Ustawienia opinii" },
  { href: "/crm", title: "Klienci (CRM)" },
  { href: "/kampanie-wysylkowe/kontakty", title: "Kontakty" },
  { href: "/kampanie-wysylkowe/nowa-wiadomosc", title: "Nowa wiadomość" },
  { href: "/kampanie-wysylkowe/historia", title: "Historia wysyłek" },
  { href: "/kampanie-wysylkowe/sekwencje", title: "Sekwencje" },
  { href: "/kampanie-wysylkowe/linki", title: "Linki" },
  { href: "/kampanie-wysylkowe/prywatne-oceny", title: "Prywatne oceny" },
  { href: "/sklep", title: "Sklep i dodatki" },
  { href: "/sklep/zamowienia", title: "Zamówienia" },
  { href: "/ustawienia/plan", title: "Plan i rozliczenia" },
  { href: "/ustawienia/profile", title: "Profile" },
  { href: "/ustawienia/kontekst", title: "Kontekst firmy" },
  { href: "/ustawienia/integracje", title: "Integracje" },
  { href: "/ustawienia/zespol", title: "Zespół" },
];
