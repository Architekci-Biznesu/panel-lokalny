import {
  HistoryFilters,
  HistoryList,
} from "@/features/publikacje/components/history-list";
import {
  parseChannelFilter,
  parseStatusFilter,
} from "@/features/publikacje/content-status";
import { loadHistory } from "@/features/publikacje/load-history";
import { getActiveProfile } from "@/lib/session";

export default async function PublikacjeWszystkiePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; kanal?: string }>;
}) {
  const params = await searchParams;
  const status = parseStatusFilter(params.status);
  const channel = parseChannelFilter(params.kanal);
  const profile = await getActiveProfile();
  const items = await loadHistory(profile, { status, channel });

  return (
    <section className="ui-section pub-history-section">
      <HistoryFilters status={status} channel={channel} />
      <HistoryList items={items} />
    </section>
  );
}
