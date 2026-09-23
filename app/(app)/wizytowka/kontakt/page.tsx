import { KontaktEditor } from "@/features/wizytowka/components/kontakt-editor";
import { tryLoadActiveGbpBundle } from "@/features/wizytowka/load-location";

export default async function KontaktPage() {
  const bundle = await tryLoadActiveGbpBundle();
  if (!bundle) return null;
  return <KontaktEditor location={bundle.location} />;
}
