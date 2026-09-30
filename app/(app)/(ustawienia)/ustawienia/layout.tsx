import { ModuleHeader } from "@/features/shell/module-header";
import { USTAWIENIA_HEADER } from "@/features/ustawienia/module";
import { UstawieniaSubnav } from "@/features/ustawienia/ustawienia-subnav";

export default function UstawieniaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="wiz-page">
      <ModuleHeader {...USTAWIENIA_HEADER} className="wiz-header" />
      <UstawieniaSubnav />
      {children}
    </div>
  );
}
