import { ModuleSubnav } from "@/features/shell/module-subnav";
import { OPINIE_TABS } from "@/features/opinie/module";

export function ReviewsSubnav({ pendingCount }: { pendingCount: number }) {
  return (
    <ModuleSubnav
      tabs={OPINIE_TABS}
      label="Zakładki opinii"
      counts={{ "/opinie": pendingCount }}
      countLabel="do odpowiedzi"
    />
  );
}
