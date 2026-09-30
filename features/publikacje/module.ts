import type { ModuleTab } from "@/features/shell/module-tabs";

/** Header and tabs of Publikacje - used by the layout and the loading skeleton. */
export const PUBLIKACJE_HEADER = {
  title: "Publikacje",
  description:
    "AI proponuje posty do wizytówki Google - akceptujesz, poprawiasz w czacie obok albo odrzucasz",
};

export const PUBLIKACJE_TABS: readonly ModuleTab[] = [
  { href: "/publikacje", label: "Posty", exact: true },
  { href: "/publikacje/kalendarz", label: "Kalendarz" },
];
