import { UslugiEditor } from "@/features/wizytowka/components/uslugi-editor";
import { tryLoadActiveGbpBundle } from "@/features/wizytowka/load-location";

export default async function UslugiPage() {
  const bundle = await tryLoadActiveGbpBundle();
  if (!bundle) return null;

  return (
    <div className="wiz-stack">
      <UslugiEditor
        location={bundle.location}
        categoryDetails={bundle.categoryDetails}
        suggestions={bundle.pendingSuggestions}
      />
    </div>
  );
}
