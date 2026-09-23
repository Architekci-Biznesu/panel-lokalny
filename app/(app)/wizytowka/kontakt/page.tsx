import { KontaktEditor } from "@/features/wizytowka/components/kontakt-editor";
import { tryLoadActiveGbpBundle } from "@/features/wizytowka/load-location";

export default async function KontaktPage() {
  const bundle = await tryLoadActiveGbpBundle();
  if (!bundle) return null;

  return (
    <div className="wiz-stack">
      <div className="wiz-tab-head">
        <div>
          <h2 className="text-lg font-semibold">Kontakt</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Witryna i profile społecznościowe. Kliknij ołówek, aby edytować.
          </p>
        </div>
      </div>
      <KontaktEditor
        location={bundle.location}
        attributes={bundle.attributes}
        attributeMetadata={bundle.attributeMetadata}
      />
    </div>
  );
}