import { GbpPreviewCard } from "@/features/wizytowka/components/gbp-preview-card";
import { LastAnalysisLabel } from "@/features/wizytowka/components/last-analysis-label";
import { ProposalCards } from "@/features/wizytowka/components/proposal-cards";
import { WizytowkaSubnav } from "@/features/wizytowka/components/wizytowka-subnav";
import { computeCompleteness } from "@/features/wizytowka/completeness";
import { loadActiveGbpBundle } from "@/features/wizytowka/load-location";
import { getUpcomingHolidayHint } from "@/features/wizytowka/polish-holidays";
import {
  countSuggestionsByTab,
  uniquePendingByField,
} from "@/features/wizytowka/proposal-meta";
import { GbpNotConnectedError } from "@/lib/integrations/gbp/access";
import {
  listGbpLocationMedia,
  pickGbpCollageUrls,
} from "@/lib/integrations/gbp/client";
import { AuthError } from "@/lib/session";
import type { GbpSuggestion } from "@/lib/db/schema";
import Link from "next/link";
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

  try {
    const bundle = await loadActiveGbpBundle();
    location = bundle.location;
    analyzing = bundle.latestAuditRun?.status === "running";
    summary = computeCompleteness({
      location: bundle.location,
      attributes: bundle.attributes,
      attributeMetadata: bundle.attributeMetadata,
      pendingSuggestions: bundle.pendingSuggestions,
      lastAnalyzedAt:
        bundle.latestAuditRun?.status === "done"
          ? bundle.latestAuditRun.finishedAt
          : bundle.latestAuditRun?.startedAt ?? null,
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

    try {
      const media = await listGbpLocationMedia(
        bundle.accessToken,
        bundle.locationName,
      );
      photoUrls = pickGbpCollageUrls(media, 6);
    } catch {
      photoUrls = [];
    }
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
    <div className="wiz-page">
      <div className="page-header wiz-header">
        <div>
          <h1>Wizytówka Google</h1>
          <p>Dane na żywo z Google Business Profile - zmiany zapisują się od razu</p>
        </div>
      </div>

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
          <LastAnalysisLabel iso={lastAnalyzedIso} />
          <ProposalCards
            suggestions={pendingSuggestions}
            specialHoursHint={specialHoursHint}
          />
          {analyzing ? (
            <div className="banner wiz-analyzing">
              Analizujemy Twoją wizytówkę… Odśwież stronę za chwilę.
            </div>
          ) : null}
          <WizytowkaSubnav counts={tabCounts} />
          <div className="wiz-tab-body">{children}</div>
        </>
      )}
    </div>
  );
}
