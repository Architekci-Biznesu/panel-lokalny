import { ModuleSubnav } from "@/features/shell/module-subnav";
import { USTAWIENIA_TABS } from "@/features/ustawienia/module";

export function UstawieniaSubnav() {
  return <ModuleSubnav tabs={USTAWIENIA_TABS} label="Zakładki ustawień" />;
}
