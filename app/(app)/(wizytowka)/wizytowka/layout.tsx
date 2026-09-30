import { GbpPreviewCard } from "@/features/wizytowka/components/gbp-preview-card";
import { LastAnalysisLabel } from "@/features/wizytowka/components/last-analysis-label";
import { AnalysisRunningGate } from "@/features/wizytowka/components/analysis-running-gate";
import { ProposalCards } from "@/features/wizytowka/components/proposal-cards";
import { PendingEditsBanner } from "@/features/wizytowka/components/pending-edits-banner";
import { ModuleHeader } from "@/features/shell/module-header";
import { WizytowkaSubnav } from "@/features/wizytowka/components/wizytowka-subnav";
import { GbpFreshness } from "@/features/wizytowka/components/gbp-freshness";
import { WizEditingProvider } from "@/features/wizytowka/components/wiz-editing";
import {
  getGbpDataStatus,
  WIZYTOWKA_SNAPSHOT_KINDS,
  type GbpDataStatus,
} from "@/features/wizytowka/snapshots/read";
import {
  computeCompleteness,
  GBP_PHOTO_MIN,
} from "@/features/wizytowka/completeness";
import { loadLatestAuditInsights } from "@/features/wizytowka/competitor-insights";
import {
  loadActiveGbpBundle,
  loadGbpMedia,
} from "@/features/wizytowka/load-location";
import { getUpcomingHolidayHint } from "@/features/wizytowka/polish-holidays";
import {
  countSuggestionsByTab,
  uniquePendingByField,
} from "@/features/wizytowka/proposal-meta";
import { GbpNotConnectedError } from "@/lib/integrations/gbp/access";
import {
  countGbpOwnerPhotos,
  pickGbpCollageUrls,
} from "@/lib/integrations/gbp/client";
import { AuthError } from "@/lib/session";
import type { GbpSuggestion } from "@/lib/db/schema";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { ReanalyzeButton } from "@/features/wizytowka/components/reanalyze-button";
import type { GbpLocation } from "@/features/wizytowka/types";

export default async function WizytowkaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let connected = true;
  let summary = null as ReturnType<typeof computeCompleteness> | null;
  let analyzing = false;
  let loadError: string | null = null;
  let location: GbpLocation | null = null;
  let photoUrls: string[] = [];
  let pendingSuggestions: GbpSuggestion[] = [];
  let lastAnalyzedIso: string | null = null;
  let tabCounts: ReturnType<typeof countSuggestionsByTab> = {};
  let specialHoursHint: string | null = null;
  let competitorPhotoMedian: number | null = null;
  let competitorPhotoMax: number | null = null;
  let ourWeeklyMinutes: number | null = null;
  let competitorHoursMedian: number | null = null;
  let competitorHoursMax: number | null = null;
  let gbpStatus: GbpDataStatus | null = null;

  try {
    const bundle = await loadActiveGbpBundle();
    location = bundle.location;
    analyzing = bundle.latestAuditRun?.status === "running";

    const [latestInsights, media] = await Promise.all([
      loadLatestAuditInsights(bundle.profile.id),
      loadGbpMedia(bundle.profile),
    ]);
    // After the reads above, so a refresh they just started shows up here.
    gbpStatus = await getGbpDataStatus(
      bundle.profile,
      WIZYTOWKA_SNAPSHOT_KINDS,
    ).catch(() => null);
    if (latestInsights?.insights.photoStats) {
      competitorPhotoMedian =
        latestInsights.insights.photoStats.competitorMedian;
      competitorPhotoMax = latestInsights.insights.photoStats.competitorMax;
    }
    if (latestInsights?.insights.hoursStats) {
      ourWeeklyMinutes = latestInsights.insights.hoursStats.ourWeeklyMinutes;
      competitorHoursMedian =
        latestInsights.insights.hoursStats.competitorMedian;
      competitorHoursMax = latestInsights.insights.hoursStats.competitorMax;
    }

    const photoCount = countGbpOwnerPhotos(media.owner);
    photoUrls = pickGbpCollageUrls([...media.owner, ...media.customers], 6);

    summary = computeCompleteness({
      location: bundle.location,
      attributes: bundle.attributes,
      attributeMetadata: bundle.attributeMetadata,
      pendingSuggestions: bundle.pendingSuggestions,
      photoCount,
      lastAnalyzedAt:
        bundle.latestAuditRun?.status === "done"
          ? bundle.latestAuditRun.finishedAt
          : (bundle.latestAuditRun?.startedAt ?? null),
    });
    pendingSuggestions = uniquePendingByField(bundle.pendingSuggestions);
    tabCounts = countSuggestionsByTab(bundle.pendingSuggestions);
    specialHoursHint = getUpcomingHolidayHint(
      bundle.location.specialHours?.specialHourPeriods ?? [],
    );
    const analyzedAt = summary.lastAnalyzedAt;
    lastAnalyzedIso =
      analyzedAt instanceof Date
        ? analyzedAt.toISOString()
        : analyzedAt
          ? new Date(analyzedAt).toISOString()
          : null;
  } catch (error) {
    if (error instanceof GbpNotConnectedError || error instanceof AuthError) {
      connected = false;
    } else {
      loadError =
        error instanceof Error
          ? error.message
          : "Nie udało się wczytać wizytówki";
    }
  }

  return (
    <WizEditingProvider>
      <div className="wiz-page">
        <AnalysisRunningGate analyzing={analyzing} />
        <ModuleHeader
          title="Wizytówka Google"
          className="wiz-header"
          below={
            gbpStatus ? (
              <GbpFreshness
                scope="wizytowka"
                fetchedAtIso={gbpStatus.fetchedAt?.toISOString() ?? null}
                refreshing={gbpStatus.refreshing}
              />
            ) : null
          }
          actions={
            <div className="wiz-header-actions">
              <Link href="/ustawienia/kontekst" className="ui-btn ui-btn-white">
                <ArrowUpRight aria-hidden />
                <span>Kontekst firmy</span>
              </Link>
              <div className="wiz-reanalyze">
                <ReanalyzeButton />
                <LastAnalysisLabel iso={lastAnalyzedIso} />
              </div>
            </div>
          }
        />

        {!connected ? (
          <div className="ui-section">
            <p className="text-sm text-muted-foreground">
              Ten profil nie ma podłączonej wizytówki Google.{" "}
              <Link href="/ustawienia/integracje" className="wiz-inline-link">
                Połącz w integracjach
              </Link>{" "}
              albo dokończ onboarding.
            </p>
          </div>
        ) : loadError ? (
          <div className="ui-section">
            <p className="text-sm text-destructive">{loadError}</p>
          </div>
        ) : (
          <>
            {location && summary ? (
              <GbpPreviewCard
                location={location}
                photoUrls={photoUrls}
                summary={summary}
              />
            ) : null}
            {location?.metadata?.hasPendingEdits ? (
              <PendingEditsBanner mapsUri={location.metadata.mapsUri ?? null} />
            ) : null}
            <ProposalCards
              suggestions={pendingSuggestions}
              specialHoursHint={specialHoursHint}
              factsToConfirm={summary?.factsToConfirm ?? 0}
              photoCount={summary?.photoCount ?? GBP_PHOTO_MIN}
              competitorPhotoMedian={competitorPhotoMedian}
              competitorPhotoMax={competitorPhotoMax}
              ourWeeklyMinutes={ourWeeklyMinutes}
              competitorHoursMedian={competitorHoursMedian}
              competitorHoursMax={competitorHoursMax}
              mapsUri={location?.metadata?.mapsUri ?? null}
            />
            <WizytowkaSubnav counts={tabCounts} />
            <div className="wiz-tab-body">{children}</div>
          </>
        )}
      </div>
    </WizEditingProvider>
  );
}
