import { Suspense } from "react";
import Link from "next/link";
import { ArrowUpRight, CalendarDays } from "lucide-react";
import { ImproveCard } from "@/features/pulpit/improve-card";
import { NewReviewsCard } from "@/features/pulpit/new-reviews-card";
import { RankPhrasesCard } from "@/features/pulpit/rank-phrases-card";
import { RecentPublicationsCard } from "@/features/pulpit/recent-publications-card";
import { ReportKpiStrip } from "@/features/pulpit/report-kpi-strip";
import { VisibilityCard } from "@/features/pulpit/visibility-card";
import {
  ImproveSkeleton,
  KpiStripSkeleton,
  VisibilitySkeleton,
} from "@/features/pulpit/pulpit-skeleton";
import {
  loadPulpitImprove,
  loadPulpitMetrics,
  type PulpitBase,
} from "@/features/pulpit/load-pulpit";
import type { PulpitReviews } from "@/features/opinie/load-pulpit-reviews";
import {
  GbpFreshness,
  GbpFreshnessPlaceholder,
} from "@/features/wizytowka/components/gbp-freshness";
import type { Profile } from "@/lib/db/schema";
import {
  getGbpDataStatus,
  PULPIT_SNAPSHOT_KINDS,
} from "@/features/wizytowka/snapshots/read";

// Tiles with Google data load inside their own Suspense boundary (from
// snapshots - usually instant); the rest of Pulpit comes from our database.

/** Age of Pulpit's Google data - read after the tiles, so a refresh they started shows. */
async function Freshness({ profile }: { profile: Profile }) {
  await Promise.all([loadPulpitMetrics(profile), loadPulpitImprove(profile)]);
  const status = await getGbpDataStatus(profile, PULPIT_SNAPSHOT_KINDS).catch(
    () => null,
  );
  if (!status) return null;
  return (
    <GbpFreshness
      scope="pulpit"
      fetchedAtIso={status.fetchedAt?.toISOString() ?? null}
      refreshing={status.refreshing}
    />
  );
}

async function RangeLabel({ profile }: { profile: Profile }) {
  const metrics = await loadPulpitMetrics(profile);
  return <>{metrics.reportRangeLabel ?? "Ostatnie 30 dni"}</>;
}

async function KpiTiles({
  profile,
  reviews,
}: {
  profile: Profile;
  reviews: PulpitReviews | null;
}) {
  const metrics = await loadPulpitMetrics(profile);
  return (
    <>
      {metrics.loadError ? (
        <p className="locked-note">{metrics.loadError}</p>
      ) : null}
      <ReportKpiStrip summary={metrics.reportSummary} reviews={reviews} />
    </>
  );
}

async function VisibilityTile({ profile }: { profile: Profile }) {
  const metrics = await loadPulpitMetrics(profile);
  return <VisibilityCard visibility={metrics.monthVisibility} />;
}

async function ImproveTile({ profile }: { profile: Profile }) {
  const data = await loadPulpitImprove(profile);
  return (
    <ImproveCard
      improve={data.improve}
      proposals={data.proposals}
      proposalsTotal={data.proposalsTotal}
    />
  );
}

export function PulpitView({ data }: { data: PulpitBase }) {
  const profile = data.profile;

  return (
    <div className="pulpit-page">
      <div className="page-header">
        <div>
          <h1>Pulpit</h1>
          {profile ? (
            <Suspense fallback={<GbpFreshnessPlaceholder />}>
              <Freshness profile={profile} />
            </Suspense>
          ) : null}
        </div>
        <div className="pulpit-header-actions">
          <span className="pulpit-range mono">
            <CalendarDays aria-hidden />
            {profile ? (
              <Suspense fallback="Ostatnie 30 dni">
                <RangeLabel profile={profile} />
              </Suspense>
            ) : (
              "Ostatnie 30 dni"
            )}
          </span>
          <Link
            href="/wizytowka/raporty"
            className="ui-btn ui-btn-outline ui-btn-sm"
          >
            Pełny raport
            <ArrowUpRight aria-hidden />
          </Link>
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

      {profile ? (
        <Suspense fallback={<KpiStripSkeleton />}>
          <KpiTiles profile={profile} reviews={data.reviews} />
        </Suspense>
      ) : (
        <ReportKpiStrip summary={null} reviews={data.reviews} />
      )}

      <div className="pulpit-grid">
        <div className="pulpit-main">
          {profile ? (
            <Suspense fallback={<VisibilitySkeleton />}>
              <VisibilityTile profile={profile} />
            </Suspense>
          ) : (
            <VisibilityCard visibility={null} />
          )}
          <RankPhrasesCard phrases={data.rankPhrases} />
        </div>

        <aside className="pulpit-side">
          {profile ? (
            <Suspense fallback={<ImproveSkeleton />}>
              <ImproveTile profile={profile} />
            </Suspense>
          ) : (
            <ImproveCard improve={null} proposals={[]} proposalsTotal={0} />
          )}
          <NewReviewsCard reviews={data.reviews} />
          <RecentPublicationsCard
            publications={data.publications}
            rhythm={data.rhythm}
          />
        </aside>
      </div>
    </div>
  );
}
