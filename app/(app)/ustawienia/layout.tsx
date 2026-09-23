import { UstawieniaSubnav } from "@/features/ustawienia/ustawienia-subnav";

export default function UstawieniaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="wiz-page">
      <div className="wiz-header">
        <div>
          <h1 className="text-xl font-semibold">Ustawienia</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Kontekst firmy, profile, integracje i plan
          </p>
        </div>
      </div>
      <UstawieniaSubnav />
      {children}
    </div>
  );
}
