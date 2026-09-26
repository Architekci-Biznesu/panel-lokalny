import Link from "next/link";
import { Plus } from "lucide-react";

export type PulpitReview = {
  id: string;
  author: string;
  initials: string;
  rating: number;
  waiting: boolean;
};

export function NewReviews({ items }: { items: PulpitReview[] }) {
  return (
    <section className="pulpit-list-block">
      <header className="pulpit-list-head">
        <h2 className="pulpit-card-title">Nowe opinie</h2>
        <Link href="/opinie" className="pulpit-list-link">
          Wszystkie
        </Link>
      </header>

      {items.length === 0 ? (
        <p className="pulpit-empty">
          {/* TODO Styl 4: podłączyć loader opinii, gdy będzie w projekcie */}
          Brak nowych opinii.
        </p>
      ) : (
        <ul className="pulpit-review-list">
          {items.map((item) => (
            <li key={item.id} className="pulpit-review-card">
              <span className="pulpit-review-avatar" aria-hidden>
                {item.initials}
              </span>
              <div className="pulpit-review-copy">
                <div className="pulpit-review-top">
                  <span className="pulpit-review-author">{item.author}</span>
                  <span
                    className={`pulpit-rating${
                      item.rating <= 3 ? " is-warn" : ""
                    }`}
                  >
                    <span className="mono">{item.rating}</span> ★
                  </span>
                </div>
                {item.waiting ? (
                  <p className="pulpit-review-wait">Czeka na odpowiedź</p>
                ) : null}
              </div>
              <Link
                href="/opinie"
                className="pulpit-review-add"
                aria-label={`Odpowiedz na opinię ${item.author}`}
              >
                <Plus aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
