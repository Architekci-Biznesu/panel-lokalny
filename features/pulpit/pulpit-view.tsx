import Link from "next/link";
import { AutoPublicationsCard } from "@/features/pulpit/auto-publications-card";
import { NewReviews } from "@/features/pulpit/new-reviews";
import { ProfileStatusCard } from "@/features/pulpit/profile-status-card";
import { RecentPublications } from "@/features/pulpit/recent-publications";
import { VisibilityCard } from "@/features/pulpit/visibility-card";
import type { PulpitPayload } from "@/features/pulpit/load-pulpit";

export function PulpitView({ data }: { data: PulpitPayload }) {
  return (
    <div className="pulpit-page">
      <div className="page-header">
        <div>
          <h1>Pulpit</h1>
          <p>Podsumowanie wizytówki, publikacji i opinii w jednym miejscu.</p>
        </div>
      </div>

      {!data.connected ? (
        <p className="locked-note">
          Ten profil nie ma podłączonej wizytówki Google.{" "}
          <Link href="/ustawienia/integracje" className="wiz-inline-link">
            Połącz w integracjach
          </Link>
          .
        </p>
      ) : null}

      {data.loadError ? <p className="locked-note">{data.loadError}</p> : null}

      <div className="pulpit-grid">
        <div className="pulpit-span-7">
          <VisibilityCard visibility={data.visibility} />
        </div>
        <div className="pulpit-span-5">
          {/* TODO Styl 4: podłączyć loader publikacji */}
          <RecentPublications items={[]} />
        </div>
        <div className="pulpit-span-3">
          {/* TODO Styl 4: podłączyć loader opinii */}
          <NewReviews items={[]} />
        </div>
        <div className="pulpit-span-4">
          <AutoPublicationsCard />
        </div>
        <div className="pulpit-span-5">
          <ProfileStatusCard status={data.status} />
        </div>
      </div>
    </div>
  );
}
