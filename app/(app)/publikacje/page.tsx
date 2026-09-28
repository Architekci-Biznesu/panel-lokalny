import { PostsWorkspace } from "@/features/publikacje/components/posts-workspace";
import {
  parseChannelFilter,
  parseStatusFilter,
} from "@/features/publikacje/content-status";
import { loadHistory } from "@/features/publikacje/load-history";
import { loadActiveRuns, loadInbox } from "@/features/publikacje/load-inbox";
import { getActiveProfile } from "@/lib/session";

export default async function PublikacjePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; kanal?: string }>;
}) {
  const params = await searchParams;
  const profile = await getActiveProfile();
  const [inbox, runs] = await Promise.all([
    loadInbox(profile),
    loadActiveRuns(profile),
  ]);

  // Without an explicit filter: proposals first when something waits.
  const status = params.status
    ? parseStatusFilter(params.status)
    : inbox.items.length || runs.length
      ? "pending"
      : "all";
  const channel = parseChannelFilter(params.kanal);
  const history =
    status === "pending"
      ? []
      : (await loadHistory(profile, { status, channel })).filter(
          (item) => item.status !== "pending",
        );

  return (
    <PostsWorkspace
      inbox={inbox}
      history={history}
      status={status}
      channel={channel}
      activeProfile={{ id: profile.id, name: profile.name }}
      initialRuns={runs}
    />
  );
}
