import { ModuleSubnav } from "@/features/shell/module-subnav";
import { PUBLIKACJE_TABS } from "@/features/publikacje/module";

export function PublikacjeSubnav({ pendingCount }: { pendingCount: number }) {
  return (
    <ModuleSubnav
      tabs={PUBLIKACJE_TABS}
      label="Zakładki publikacji"
      counts={{ "/publikacje": pendingCount }}
      countLabel="do akceptacji"
    />
  );
}
