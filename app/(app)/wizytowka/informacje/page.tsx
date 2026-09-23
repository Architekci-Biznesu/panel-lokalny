import { GodzinyView } from "@/features/wizytowka/components/godziny-view";
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

  return (
    <div className="wiz-stack">
      <div className="wiz-tab-head">
        <div>
          <h2 className="text-base font-semibold">Informacje o firmie</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Kliknij ołówek, aby edytować. Propozycje AI są wyróżnione przy
            polach.
          </p>
        </div>
      </div>

      <OutsideGaps gaps={summary.outsidePanelGaps} />

      <InformacjeEditor
        location={bundle.location}
        categoryOptions={categoryOptions}
        suggestions={bundle.pendingSuggestions}
      />

      <GodzinyView location={bundle.location} />
    </div>
  );
}
