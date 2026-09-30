import { SkelText } from "@/features/shell/skeleton";

// Modules without their own skeleton (CRM, Kampanie, Strona, Sklep) - the same
// single card with a title as their pages (PlaceholderPage), bars inside real
// text lines so the heights match. The navbar from app/(app)/layout.tsx stays.
export default function AppLoading() {
  return (
    <section className="ui-section" aria-busy="true" aria-label="Ładowanie">
      <div className="page-header">
        <div>
          <h1>
            <SkelText w="16rem" h="2.25rem" />
          </h1>
          <p>
            <SkelText w="24rem" />
          </p>
        </div>
      </div>
      <p className="mt-4 text-sm">
        <SkelText w="8rem" />
      </p>
    </section>
  );
}
