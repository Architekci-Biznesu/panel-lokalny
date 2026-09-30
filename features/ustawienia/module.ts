import type { ModuleTab } from "@/features/shell/module-tabs";

/** Header and tabs of Ustawienia - used by the layout and the loading skeleton. */
export const USTAWIENIA_HEADER = {
  title: "Ustawienia",
  description: "Kontekst firmy, profile, integracje i plan",
};

export const USTAWIENIA_TABS: readonly ModuleTab[] = [
  { href: "/ustawienia/kontekst", label: "Kontekst firmy" },
  { href: "/ustawienia/profile", label: "Profile" },
  { href: "/ustawienia/integracje", label: "Integracje" },
  { href: "/ustawienia/zespol", label: "Zespół" },
  { href: "/ustawienia/plan", label: "Plan i rozliczenia" },
];
