import { PulpitView } from "@/features/pulpit/pulpit-view";
import { loadPulpitPayload } from "@/features/pulpit/load-pulpit";

export default async function Page() {
  const data = await loadPulpitPayload();
  return <PulpitView data={data} />;
}
