import { Star } from "lucide-react";

/** Five stars for a rating; 1-2 stars are drawn in coral. Stars-only reviews still have a rating. */
export function ReviewStars({ rating }: { rating: number | null }) {
  if (rating === null) return <span className="op-no-rating">Brak oceny</span>;
  return (
    <span
      className={`op-stars${rating <= 2 ? " is-low" : ""}`}
      role="img"
      aria-label={`${rating} z 5 gwiazdek`}
    >
      {Array.from({ length: 5 }, (_, index) => (
        <Star
          key={index}
          aria-hidden
          className={index < rating ? "is-on" : undefined}
        />
      ))}
    </span>
  );
}
