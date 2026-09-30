import type { ModuleTab } from "@/features/shell/module-tabs";

/** Header and tabs of Opinie - used by the layout and the loading skeleton. */
export const OPINIE_HEADER = {
  title: "Opinie",
  description:
    "Opinie z wizytówki Google i gotowe odpowiedzi od AI - publikujesz jednym kliknięciem albo poprawiasz je sam",
};

export const OPINIE_TABS: readonly ModuleTab[] = [
  { href: "/opinie", label: "Opinie", exact: true },
  { href: "/opinie/ustawienia", label: "Ustawienia odpowiedzi" },
];
