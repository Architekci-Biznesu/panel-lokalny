import { Star } from "lucide-react";

const RATING_FMT = new Intl.NumberFormat("pl-PL", {
  maximumFractionDigits: 1,
});

/**
 * Five stars for a rating. Fractions are drawn too (4,7 = four full stars and
 * the fifth filled in 70%), so the same component serves the average.
 * Stars-only reviews still have a rating.
 */
export function ReviewStars({
  rating,
  size = "md",
}: {
  rating: number | null;
  size?: "sm" | "md" | "lg";
}) {
  if (rating === null) return <span className="op-no-rating">Brak oceny</span>;
  return (
    <span
      className={`op-stars is-${size}`}
      role="img"
      aria-label={`${RATING_FMT.format(rating)} z 5 gwiazdek`}
    >
      {Array.from({ length: 5 }, (_, index) => {
        const fill = Math.min(1, Math.max(0, rating - index));
        return (
          <span key={index} className="op-star">
            <Star aria-hidden />
            {fill > 0 ? (
              <span
                className="op-star-fill"
                style={{ width: `${Math.round(fill * 100)}%` }}
              >
                <Star aria-hidden />
              </span>
            ) : null}
          </span>
        );
      })}
    </span>
  );
}
