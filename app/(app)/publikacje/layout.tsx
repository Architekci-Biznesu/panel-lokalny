import Link from "next/link";
import { SquarePen } from "lucide-react";
import { GenerateProposalButton } from "@/features/publikacje/components/generate-proposal-button";
import { PublikacjeSubnav } from "@/features/publikacje/components/publikacje-subnav";
import { countPendingContent } from "@/features/publikacje/load-inbox";
import { getActiveProfile } from "@/lib/session";

export default async function PublikacjeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getActiveProfile();
  const pendingCount = await countPendingContent(profile);

  return (
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
          <GenerateProposalButton />
        </div>
      </div>
      <PublikacjeSubnav pendingCount={pendingCount} />
      <div className="pub-body">{children}</div>
    </div>
  );
}
