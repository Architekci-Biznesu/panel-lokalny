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
        <div className="page-header">
          <div>
            <h1>Publikacje</h1>
            <p>
              AI proponuje posty do wizytówki Google - akceptujesz, poprawiasz w
              czacie obok albo odrzucasz
            </p>
          </div>
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
        </div>
        <PublikacjeSubnav pendingCount={pendingCount} />
        <div className="pub-body">{children}</div>
      </div>
    </TopicsStateProvider>
  );
}
