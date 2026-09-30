import { AtrybutyView } from "@/features/wizytowka/components/atrybuty-view";
import { tryLoadActiveGbpBundle } from "@/features/wizytowka/load-location";

export default async function AtrybutyPage() {
  const bundle = await tryLoadActiveGbpBundle();
  if (!bundle) return null;

  return (
    <AtrybutyView
      attributes={bundle.attributes}
      attributeMetadata={bundle.attributeMetadata}
    />
  );
}
