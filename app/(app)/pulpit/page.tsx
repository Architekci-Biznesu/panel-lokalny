import { PulpitView } from "@/features/pulpit/pulpit-view";
import { loadPulpitBase } from "@/features/pulpit/load-pulpit";

export default async function Page() {
  const data = await loadPulpitBase();
  return <PulpitView data={data} />;
}
