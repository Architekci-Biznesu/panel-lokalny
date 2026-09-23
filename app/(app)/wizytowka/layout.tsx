import { CompletenessBar } from "@/features/wizytowka/components/completeness-bar";
import { GbpPreviewCard } from "@/features/wizytowka/components/gbp-preview-card";
import { ReanalyzeButton } from "@/features/wizytowka/components/reanalyze-button";
import { WizytowkaSubnav } from "@/features/wizytowka/components/wizytowka-subnav";
import { computeCompleteness } from "@/features/wizytowka/completeness";
import { loadActiveGbpBundle } from "@/features/wizytowka/load-location";
import { GbpNotConnectedError } from "@/lib/integrations/gbp/access";
import {
  listGbpLocationMedia,
  pickGbpCoverUrl,
} from "@/lib/integrations/gbp/client";
import { AuthError } from "@/lib/session";
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
  let coverUrl: string | null = null;

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

    try {
      const media = await listGbpLocationMedia(
        bundle.accessToken,
        bundle.locationName,
      );
      coverUrl = pickGbpCoverUrl(media);
    } catch {
      coverUrl = null;
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
      <div className="wiz-header">
        <div>
          <h1 className="text-xl font-semibold">Wizytówka Google</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Dane na żywo z Google Business Profile
          </p>
        </div>
        {connected ? <ReanalyzeButton /> : null}
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
          {location ? (
            <GbpPreviewCard location={location} coverUrl={coverUrl} />
          ) : null}
          {summary ? <CompletenessBar summary={summary} /> : null}
          {analyzing ? (
            <div className="banner wiz-analyzing">
              Analizujemy Twoją wizytówkę… Odśwież stronę za chwilę.
            </div>
          ) : null}
          <WizytowkaSubnav />
          <div className="ui-section wiz-tab-body">{children}</div>
        </>
      )}
    </div>
  );
}
