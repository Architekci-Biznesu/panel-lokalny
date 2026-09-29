import { ChevronRight, Hand, Sparkles, Zap } from "lucide-react";
import Link from "next/link";
import { ReviewStars } from "@/features/opinie/components/review-stars";
import type { ReviewStats } from "@/features/opinie/load-reviews";
import type { RatingFilter } from "@/features/opinie/review-rules";
import type {
  ReplyPerspective,
  ReplyStyle,
} from "@/features/opinie/review-settings";
import type { ReviewMode } from "@/lib/db/schema";

const AVG_FMT = new Intl.NumberFormat("pl-PL", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/** Segments of the "Z odpowiedzią" bar - each one is 2% of the reviews. */
const BAR_SEGMENTS = 50;

function reviewsWord(count: number): string {
  if (count === 1) return "opinia";
  const last = count % 10;
  const lastTwo = count % 100;
  return last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)
    ? "opinie"
    : "opinii";
}

function draftsWord(count: number): string {
  if (count === 1) return "szkic od AI gotowy";
  const last = count % 10;
  const lastTwo = count % 100;
  return last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)
    ? "szkice od AI gotowe"
    : "szkiców od AI gotowych";
}

/** Rating group of the list filter a single star count belongs to. */
function ratingGroup(stars: number): RatingFilter {
  if (stars <= 2) return "low";
  if (stars === 3) return "mid";
  return "high";
}

export type ReviewVoice = {
  mode: ReviewMode;
  perspective: ReplyPerspective;
  style: ReplyStyle;
};

/**
 * Above the list: the average and rating spread, what waits for a reply, and a
 * link to the reply settings showing the current mode and style.
 */
export function ReviewsSummary({
  stats,
  averageRating,
  totalCount,
  voice,
  ratingHref,
}: {
  stats: ReviewStats;
  /** Google's average for the whole listing (preferred over the stored reviews) */
  averageRating: number | null;
  /** Google's review count for the listing */
  totalCount: number | null;
  voice: ReviewVoice;
  ratingHref: (rating: RatingFilter) => string;
}) {
  const average = averageRating ?? stats.average;
  const count = totalCount ?? stats.total;
  const spread = Math.max(1, stats.total);
  const repliedShare = stats.total > 0 ? stats.replied / stats.total : 0;
  const filled = Math.round(repliedShare * BAR_SEGMENTS);
  const auto = voice.mode === "auto";

  return (
    <div className="op-summary">
      <section className="op-summary-card" aria-label="Podsumowanie opinii">
        <div className="op-summary-rating">
          <div className="op-summary-score">
            <span className="op-summary-label">Średnia ocena</span>
            <span className="op-summary-big mono">
              {average !== null ? AVG_FMT.format(average) : "-"}
            </span>
            {average !== null ? (
              <ReviewStars rating={average} size="md" />
            ) : null}
            <span className="op-summary-note">
              <span className="mono">{count}</span> {reviewsWord(count)} w
              Google
            </span>
          </div>
          <ol className="op-summary-bars" aria-label="Rozkład ocen">
            {[5, 4, 3, 2, 1].map((stars) => {
              const value = stats.byRating[stars - 1];
              return (
                <li key={stars}>
                  <Link
                    href={ratingHref(ratingGroup(stars))}
                    className="op-summary-bar"
                    aria-label={`${stars} gwiazdek: ${value}`}
                  >
                    <span className="mono">{stars}</span>
                    <span className="op-summary-track">
                      <span style={{ width: `${(value / spread) * 100}%` }} />
                    </span>
                    <span className="mono op-summary-count">{value}</span>
                  </Link>
                </li>
              );
            })}
          </ol>
        </div>

        <div className="op-summary-todo">
          <span className="op-summary-label">Do odpowiedzi</span>
          <p className="op-summary-pending">
            <span className="op-summary-big mono">{stats.pending}</span>
            <span className="op-summary-note">
              {stats.pending === 1 ? "opinia czeka" : "opinii czeka"}
            </span>
          </p>
          <ul className="op-summary-dots">
            <li>
              <span className="op-dot is-low" aria-hidden />
              <span className="mono">{stats.pendingLow}</span> z oceną 1-2
            </li>
            <li>
              <span className="op-dot is-ai" aria-hidden />
              <span className="mono">{stats.draftsReady}</span>{" "}
              {draftsWord(stats.draftsReady)}
            </li>
          </ul>
          <div className="op-summary-progress">
            <span className="op-summary-progress-head">
              <span>Z odpowiedzią</span>
              <span className="mono">
                {stats.replied}/{stats.total}
              </span>
            </span>
            <span className="op-summary-segments" aria-hidden>
              {Array.from({ length: BAR_SEGMENTS }, (_, index) => (
                <span
                  key={index}
                  className={index < filled ? "is-on" : undefined}
                />
              ))}
            </span>
          </div>
        </div>
      </section>

      <Link href="/opinie/ustawienia" className="op-setcard">
        <span className="op-setcard-head">
          <span className="op-setcard-main">
            <span className="op-summary-label">Tryb odpowiedzi</span>
            <span className="op-setcard-title">
              {auto ? <Zap aria-hidden /> : <Hand aria-hidden />}
              {auto ? "Automatycznie" : "Ręcznie"}
            </span>
            <span className="op-setcard-desc">
              {auto
                ? "Odpowiedzi na oceny 3-5 publikujemy sami, 1-2 czekają na Ciebie"
                : "Akceptujesz każdą odpowiedź przed publikacją"}
            </span>
          </span>
          <span className="op-setcard-arrow" aria-hidden>
            <ChevronRight />
          </span>
        </span>
        <span className="op-setcard-foot">
          <span>Styl</span>
          <span className="op-setcard-style">
            <Sparkles aria-hidden />
            {voice.style === "warm" ? "Ciepły" : "Formalny"} ·{" "}
            {voice.perspective === "team"
              ? "w imieniu zespołu"
              : "w imieniu właściciela"}
          </span>
        </span>
        <span className="sr-only">Zmień w ustawieniach odpowiedzi</span>
      </Link>
    </div>
  );
}
