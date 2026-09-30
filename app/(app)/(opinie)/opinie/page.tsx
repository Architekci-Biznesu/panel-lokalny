import Link from "next/link";
import { ReviewsWorkspace } from "@/features/opinie/components/reviews-workspace";
import {
  countGeneratingDrafts,
  loadReviewStats,
  loadReviews,
} from "@/features/opinie/load-reviews";
import {
  REVIEWS_PAGE_SIZE,
  parseReviewRating,
  parseReviewStatus,
} from "@/features/opinie/review-filters";
import { ensureFreshReviewSync } from "@/features/opinie/start-sync";
import { loadReviewSyncState } from "@/features/opinie/sync-control";
import { getActiveProfile } from "@/lib/session";

export default async function OpiniePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; ocena?: string; limit?: string }>;
}) {
  const params = await searchParams;
  const profile = await getActiveProfile();

  if (!profile.gbpLocationId || !profile.oauthConnectionId) {
    return (
      <p className="locked-note">
        Ten profil nie ma podłączonej wizytówki Google.{" "}
        <Link href="/ustawienia/integracje" className="wiz-inline-link">
          Połącz w integracjach
        </Link>
        , żeby zobaczyć opinie.
      </p>
    );
  }

  // Opening the page checks Google when the last check is older than 15 minutes.
  await ensureFreshReviewSync(profile);

  const status = parseReviewStatus(params.status);
  const rating = parseReviewRating(params.ocena);
  const limit = Math.min(
    500,
    Math.max(REVIEWS_PAGE_SIZE, Number.parseInt(params.limit ?? "", 10) || 0),
  );

  const [list, state, generating, stats] = await Promise.all([
    loadReviews(profile, { status, rating, limit }),
    loadReviewSyncState(profile.id),
    countGeneratingDrafts(profile),
    loadReviewStats(profile),
  ]);

  return (
    <ReviewsWorkspace
      items={list.items}
      counts={list.counts}
      hasMore={list.hasMore}
      status={status}
      rating={rating}
      limit={limit}
      totalStored={list.total}
      stats={stats}
      voice={{
        mode: profile.reviewMode,
        perspective: profile.reviewPerspective,
        style: profile.reviewStyle,
      }}
      sync={{
        running: state.running,
        lastSyncedAt: state.lastSyncedAt?.toISOString() ?? null,
        lastError: state.lastError,
        averageRating: state.averageRating,
        totalCount: state.totalCount,
        generating,
      }}
    />
  );
}
