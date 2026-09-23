import { UstawieniaSubnav } from "@/features/ustawienia/ustawienia-subnav";

export default function UstawieniaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="wiz-page">
      <div className="page-header wiz-header">
        <div>
          <h1>Ustawienia</h1>
          <p>Kontekst firmy, profile, integracje i plan</p>
        </div>
      </div>
      <UstawieniaSubnav />
      {children}
    </div>
  );
}
