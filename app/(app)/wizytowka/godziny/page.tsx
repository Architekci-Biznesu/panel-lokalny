import { GodzinyAtrybutyView } from "@/features/wizytowka/components/godziny-view";
import { tryLoadActiveGbpBundle } from "@/features/wizytowka/load-location";

export default async function GodzinyPage() {
  const bundle = await tryLoadActiveGbpBundle();
  if (!bundle) return null;

  return (
    <GodzinyAtrybutyView
      location={bundle.location}
      attributes={bundle.attributes}
      attributeMetadata={bundle.attributeMetadata}
    />
  );
}
