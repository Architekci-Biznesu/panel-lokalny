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
  const pendingCount = await countPendingContent(profile.id);

  return (
    <div className="pub-page">
      <div className="page-header">
        <div>
          <h1>Publikacje</h1>
          <p>
            AI proponuje posty do wizytówki Google - Ty akceptujesz, poprawiasz
            w czacie albo odrzucasz
          </p>
        </div>
        <GenerateProposalButton />
      </div>
      <PublikacjeSubnav pendingCount={pendingCount} />
      <div className="pub-body">{children}</div>
    </div>
  );
}
