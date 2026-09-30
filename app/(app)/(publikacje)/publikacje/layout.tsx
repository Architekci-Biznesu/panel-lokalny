import Link from "next/link";
import { SquarePen } from "lucide-react";
import { PublikacjeSubnav } from "@/features/publikacje/components/publikacje-subnav";
import {
  TopicsButton,
  TopicsStateProvider,
} from "@/features/publikacje/components/topics-button";
import {
  countPendingContent,
  loadActiveRuns,
  loadTopics,
} from "@/features/publikacje/load-inbox";
import { getActiveProfile } from "@/lib/session";
import { ModuleHeader } from "@/features/shell/module-header";
import { PUBLIKACJE_HEADER } from "@/features/publikacje/module";

export default async function PublikacjeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getActiveProfile();
  const [pendingCount, topics, runs] = await Promise.all([
    countPendingContent(profile),
    loadTopics(profile),
    loadActiveRuns(profile),
  ]);
  const generating = runs.some((run) => run.kind === "topics");

  return (
    <TopicsStateProvider open={topics.length} generating={generating}>
      <div className="pub-page">
        <ModuleHeader
          {...PUBLIKACJE_HEADER}
          actions={
            <div className="pub-header-actions">
              <Link href="/publikacje?nowy=1" className="ui-btn ui-btn-white">
                <SquarePen aria-hidden />
                Nowy post
              </Link>
              <TopicsButton
                className="ui-btn ui-btn-primary"
                pickLabel="Wygeneruj posty"
              />
            </div>
          }
        />
        <PublikacjeSubnav pendingCount={pendingCount} />
        <div className="pub-body">{children}</div>
      </div>
    </TopicsStateProvider>
  );
}
