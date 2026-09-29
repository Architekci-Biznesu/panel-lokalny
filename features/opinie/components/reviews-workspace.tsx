"use client";

import { Check, Inbox, Loader2, RefreshCw, Star } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "gooey-toast";
import { getReviewSyncStatus, refreshReviews } from "@/features/opinie/actions";
import { ReviewCard } from "@/features/opinie/components/review-card";
import type { ReviewCounts, ReviewItem } from "@/features/opinie/load-reviews";
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

const RATING_FMT = new Intl.NumberFormat("pl-PL", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
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

function ratingLabel(count: number): string {
  if (count === 1) return "opinia";
  const last = count % 10;
  const lastTwo = count % 100;
  return last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)
    ? "opinie"
    : "opinii";
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
  autoMode,
  totalStored,
}: {
  items: ReviewItem[];
  counts: ReviewCounts;
  hasMore: boolean;
  status: ReviewStatusFilter;
  rating: RatingFilter;
  limit: number;
  sync: ReviewsSyncInfo;
  autoMode: boolean;
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
      <header className="op-summary">
        <div className="op-score">
          {sync.averageRating !== null ? (
            <>
              <span className="op-score-value mono">
                {RATING_FMT.format(sync.averageRating)}
              </span>
              <Star aria-hidden className="op-score-star" />
            </>
          ) : null}
          <span className="op-score-count">
            {sync.totalCount !== null
              ? `${sync.totalCount} ${ratingLabel(sync.totalCount)} w Google`
              : "Opinie z wizytówki Google"}
          </span>
        </div>
        <div className="op-summary-side">
          <span className="ui-pill ui-pill-neutral">
            {autoMode
              ? "Tryb: automatycznie dla ocen 3-5"
              : "Tryb: akceptuję każdą odpowiedź"}
          </span>
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
      </header>

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
