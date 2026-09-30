"use client";

import { Check, Inbox, Loader2, RefreshCw, Star } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "@/lib/toast";
import { getReviewSyncStatus, refreshReviews } from "@/features/opinie/actions";
import { ReviewCard } from "@/features/opinie/components/review-card";
import {
  ReviewsSummary,
  type ReviewVoice,
} from "@/features/opinie/components/reviews-summary";
import type {
  ReviewCounts,
  ReviewItem,
  ReviewStats,
} from "@/features/opinie/load-reviews";
import {
  REVIEW_RATING_FILTERS,
  REVIEW_STATUS_FILTERS,
  REVIEWS_PAGE_SIZE,
  type ReviewStatusFilter,
} from "@/features/opinie/review-filters";
import type { RatingFilter } from "@/features/opinie/review-rules";

const POLL_MS = 2500;

const SYNC_FMT = new Intl.DateTimeFormat("pl-PL", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Warsaw",
});

export type ReviewsSyncInfo = {
  running: boolean;
  lastSyncedAt: string | null;
  lastError: string | null;
  averageRating: number | null;
  totalCount: number | null;
  generating: number;
};

function listHref(
  status: ReviewStatusFilter,
  rating: RatingFilter,
  limit = REVIEWS_PAGE_SIZE,
): string {
  const params = new URLSearchParams();
  if (status !== "pending") params.set("status", status);
  if (rating !== "all") params.set("ocena", rating);
  if (limit > REVIEWS_PAGE_SIZE) params.set("limit", String(limit));
  const query = params.toString();
  return query ? `/opinie?${query}` : "/opinie";
}

/**
 * One list of reviews with filters (not separate routes). Polls while a sync
 * or draft writing is running and refreshes the list as things land.
 */
export function ReviewsWorkspace({
  items,
  counts,
  hasMore,
  status,
  rating,
  limit,
  sync,
  stats,
  voice,
  totalStored,
}: {
  items: ReviewItem[];
  counts: ReviewCounts;
  hasMore: boolean;
  status: ReviewStatusFilter;
  rating: RatingFilter;
  limit: number;
  sync: ReviewsSyncInfo;
  stats: ReviewStats;
  voice: ReviewVoice;
  /** Reviews stored for the profile, whatever the filters */
  totalStored: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const busy = sync.running || sync.generating > 0;
  const seen = useRef(`${sync.running}:${sync.generating}`);
  const [pollError, setPollError] = useState(false);

  // While work runs in the background: check its progress and refresh the list
  // whenever it changes (and once more when it ends).
  useEffect(() => {
    if (!busy) return;
    const timer = setInterval(async () => {
      const result = await getReviewSyncStatus();
      if (!result.ok) {
        setPollError(true);
        return;
      }
      setPollError(false);
      const key = `${result.running}:${result.generating}:${result.pending}`;
      if (key !== seen.current) {
        seen.current = key;
        router.refresh();
      }
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [busy, router]);

  function refresh() {
    startTransition(async () => {
      const result = await refreshReviews();
      if (!result.ok) {
        toast.error({
          title: "Nie sprawdzono opinii",
          description: result.error,
        });
        return;
      }
      router.refresh();
    });
  }

  const checking = sync.running || pending;
  const firstImport = totalStored === 0 && sync.running;

  return (
    <div className="op-workspace">
      <ReviewsSummary
        stats={stats}
        averageRating={sync.averageRating}
        totalCount={sync.totalCount}
        voice={voice}
        ratingHref={(value) => listHref(status, value)}
      />

      {sync.lastError && !sync.running ? (
        <p className="locked-note">
          Nie udało się sprawdzić opinii: {sync.lastError}
        </p>
      ) : null}
      {pollError ? (
        <p className="locked-note">
          Utracono połączenie - odśwież stronę, żeby zobaczyć najnowszy stan.
        </p>
      ) : null}

      <div className="op-filters">
        <nav className="ui-seg" aria-label="Status">
          {REVIEW_STATUS_FILTERS.map((filter) => {
            const active = status === filter.value;
            return (
              <Link
                key={filter.value}
                href={listHref(filter.value, rating)}
                className={`ui-seg-item${active ? " is-active" : ""}`}
                aria-current={active ? "true" : undefined}
              >
                {filter.label}
                <span className="ui-seg-count mono">
                  {counts.status[filter.value]}
                </span>
              </Link>
            );
          })}
        </nav>
        <nav className="ui-seg" aria-label="Ocena">
          {REVIEW_RATING_FILTERS.map((filter) => {
            const active = rating === filter.value;
            return (
              <Link
                key={filter.value}
                href={listHref(status, filter.value)}
                className={`ui-seg-item${active ? " is-active" : ""}`}
                aria-current={active ? "true" : undefined}
              >
                {filter.value === "all" ? (
                  filter.label
                ) : (
                  <>
                    {filter.label}
                    <Star aria-hidden className="op-seg-star" />
                    <span className="ui-seg-count mono">
                      {counts.rating[filter.value]}
                    </span>
                  </>
                )}
              </Link>
            );
          })}
        </nav>
        <div className="op-sync">
          <span className="op-synced">
            {checking ? (
              <>
                <Loader2 aria-hidden className="ui-btn-spinner" />
                Sprawdzam opinie w Google…
              </>
            ) : sync.lastSyncedAt ? (
              <>
                Sprawdzono{" "}
                <span className="mono">
                  {SYNC_FMT.format(new Date(sync.lastSyncedAt))}
                </span>
              </>
            ) : (
              "Jeszcze nie sprawdzano"
            )}
          </span>
          <button
            type="button"
            className="ui-btn ui-btn-white ui-btn-sm"
            disabled={checking}
            onClick={refresh}
          >
            <RefreshCw aria-hidden />
            Odśwież
          </button>
        </div>
      </div>

      {firstImport ? (
        <section className="op-empty" aria-busy="true">
          <span className="op-empty-icon" aria-hidden>
            <Loader2 className="ui-btn-spinner" />
          </span>
          <h2 className="op-empty-title">Pobieram opinie z Google…</h2>
          <p className="op-empty-text">
            Pierwsze sprawdzenie ściąga całą historię, więc chwilę potrwa. Lista
            uzupełni się sama.
          </p>
        </section>
      ) : items.length === 0 ? (
        <section className="op-empty">
          <span className="op-empty-icon" aria-hidden>
            {status === "pending" && totalStored > 0 ? <Check /> : <Inbox />}
          </span>
          <h2 className="op-empty-title">
            {totalStored === 0
              ? "Brak opinii"
              : status === "pending"
                ? "Wszystko odpowiedziane"
                : "Brak opinii dla tych filtrów"}
          </h2>
          <p className="op-empty-text">
            {totalStored === 0
              ? "Gdy klienci zostawią opinię w Google, zobaczysz ją tutaj razem z propozycją odpowiedzi."
              : status === "pending"
                ? "Nic nie czeka na Twoją odpowiedź."
                : "Zmień filtry, żeby zobaczyć inne opinie."}
          </p>
        </section>
      ) : (
        <div className="op-list">
          <div className="op-list-head" aria-hidden>
            <span>Opinia klienta</span>
            <span>Twoja odpowiedź</span>
          </div>
          {items.map((item) => (
            <ReviewCard key={item.id} item={item} />
          ))}
          {hasMore ? (
            <Link
              href={listHref(status, rating, limit + REVIEWS_PAGE_SIZE)}
              className="ui-btn ui-btn-white op-more"
              scroll={false}
            >
              Pokaż więcej
            </Link>
          ) : null}
        </div>
      )}
    </div>
  );
}
