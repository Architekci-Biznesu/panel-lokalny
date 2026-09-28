import { ContentApprovalCard } from "@/features/publikacje/components/content-approval-card";
import { GenerateProposalButton } from "@/features/publikacje/components/generate-proposal-button";
import { loadInbox } from "@/features/publikacje/load-inbox";
import { getActiveProfile } from "@/lib/session";

export default async function PublikacjeInboxPage() {
  const profile = await getActiveProfile();
  const inbox = await loadInbox(profile);

  if (inbox.items.length === 0) {
    return (
      <section className="ui-section pub-empty">
        <h2 className="pub-empty-title">Nic nie czeka na akceptację</h2>
        <p className="pub-empty-text">
          Poproś AI o nową propozycję posta - weźmie pod uwagę kontekst firmy i
          ostatnie publikacje, żeby nie powtarzać tematów.
        </p>
        <GenerateProposalButton />
      </section>
    );
  }

  return (
    <div className="pub-stack">
      {inbox.items.map((item) => (
        <ContentApprovalCard
          key={item.id}
          item={item}
          channels={inbox.channels}
          groupName={inbox.groupName}
          groupSiblings={inbox.groupSiblings}
          activeProfile={{ id: profile.id, name: profile.name }}
        />
      ))}
    </div>
  );
}
