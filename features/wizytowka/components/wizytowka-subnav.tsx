import { ModuleSubnav } from "@/features/shell/module-subnav";
import { WIZ_TABS, type WizTabHref } from "@/features/wizytowka/proposal-meta";

export function WizytowkaSubnav({
  counts = {},
}: {
  counts?: Partial<Record<WizTabHref, number>>;
}) {
  return (
    <ModuleSubnav
      tabs={WIZ_TABS}
      label="Zakładki wizytówki"
      counts={counts}
      countLabel="propozycji"
    />
  );
}
