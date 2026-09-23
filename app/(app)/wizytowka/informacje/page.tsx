import Link from "next/link";
import { InformacjeEditor } from "@/features/wizytowka/components/informacje-editor";
import { OutsideGaps } from "@/features/wizytowka/components/outside-gaps";
import { computeCompleteness } from "@/features/wizytowka/completeness";
import { tryLoadActiveGbpBundle } from "@/features/wizytowka/load-location";
import { listGbpCategories } from "@/lib/integrations/gbp/client";

export default async function InformacjePage() {
  const bundle = await tryLoadActiveGbpBundle();
  if (!bundle) return null;

  const summary = computeCompleteness({
    location: bundle.location,
    attributes: bundle.attributes,
    attributeMetadata: bundle.attributeMetadata,
    pendingSuggestions: bundle.pendingSuggestions,
    lastAnalyzedAt: bundle.latestAuditRun?.finishedAt ?? null,
  });

  const categoryOptions = await listGbpCategories(bundle.accessToken).catch(
    () =>
      bundle.categoryDetails.map((c) => ({
        name: c.name,
        displayName: c.displayName,
      })),
  );

  const hasPending = bundle.pendingSuggestions.length > 0;

  return (
    <div className="wiz-stack">
      {hasPending ? (
        <p className="text-sm text-muted-foreground">
          Propozycje nie pasują do tego, czym się zajmujesz?{" "}
          <Link href="/ustawienia/kontekst" className="wiz-inline-link">
            Zaktualizuj kontekst firmy
          </Link>
          .
        </p>
      ) : null}
      <OutsideGaps gaps={summary.outsidePanelGaps} />
      <div>
        <h2 className="text-base font-semibold">Informacje o firmie</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Edytuj ołówkiem - zapis idzie od razu do Google. Propozycje AI są
          pokazane przy polach.
        </p>
        <div className="mt-4">
          <InformacjeEditor
            location={bundle.location}
            categoryDetails={bundle.categoryDetails}
            categoryOptions={categoryOptions}
            suggestions={bundle.pendingSuggestions}
          />
        </div>
      </div>
    </div>
  );
}
