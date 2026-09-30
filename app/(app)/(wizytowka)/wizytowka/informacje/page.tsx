import { GodzinyView } from "@/features/wizytowka/components/godziny-view";
import { InformacjeEditor } from "@/features/wizytowka/components/informacje-editor";
import {
  loadCategoryOptions,
  tryLoadActiveGbpBundle,
} from "@/features/wizytowka/load-location";

export default async function InformacjePage() {
  const bundle = await tryLoadActiveGbpBundle();
  if (!bundle) return null;

  const categoryOptions = await loadCategoryOptions(
    bundle.profile,
    bundle.categoryDetails,
  );

  return (
    <div className="wiz-stack">
      <div className="wiz-tab-head">
        <div>
          <h2>Informacje o firmie</h2>
          <p>
            Kliknij ołówek, aby edytować. Propozycje AI są wyróżnione przy
            polach.
          </p>
        </div>
      </div>

      <InformacjeEditor
        location={bundle.location}
        categoryOptions={categoryOptions}
        suggestions={bundle.pendingSuggestions}
      />

      <GodzinyView location={bundle.location} />
    </div>
  );
}
