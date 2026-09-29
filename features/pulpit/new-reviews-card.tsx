import Link from "next/link";
import { ArrowUpRight, ChevronRight, MessageSquare } from "lucide-react";
import type { PulpitReviews } from "@/features/opinie/load-pulpit-reviews";

const DATE_FMT = new Intl.DateTimeFormat("pl-PL", {
  day: "numeric",
  month: "short",
  timeZone: "Europe/Warsaw",
});

function initials(name: string): string {
  const letters = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
  return letters || "?";
}

/** Pulpit: the newest reviews still waiting for a reply (from the Opinie module). */
export function NewReviewsCard({ reviews }: { reviews: PulpitReviews | null }) {
  const items = reviews?.items ?? [];

  return (
    <section className="pulpit-card">
      <header className="pulpit-card-head">
        <div className="pulpit-title-row">
          <span className="pulpit-icon-circle is-dark" aria-hidden>
            <MessageSquare />
          </span>
          <div>
            <h2 className="pulpit-card-title">Nowe opinie</h2>
            <p className="pulpit-card-lead">
              {reviews && reviews.pending > 0
                ? `${reviews.pending} czeka na odpowiedź.`
                : "Opinie z wizytówki Google."}
            </p>
          </div>
        </div>
      </header>

      {items.length === 0 ? (
        <p className="pulpit-empty">
          {reviews
            ? "Wszystkie opinie mają odpowiedź."
            : "Nie udało się wczytać opinii."}{" "}
          <Link href="/opinie" className="wiz-inline-link">
            Zobacz opinie
          </Link>
          .
        </p>
      ) : (
        <ul className="pulpit-action-list">
          {items.map((item) => (
            <li key={item.id}>
              <Link href="/opinie?status=pending" className="pulpit-action-row">
                <span className="pulpit-action-icon is-initials" aria-hidden>
                  {initials(item.authorName)}
                </span>
                <span className="pulpit-action-copy">
                  <span className="pulpit-action-title">
                    {item.authorName.trim() || "Użytkownik Google"}
                  </span>
                  <span className="pulpit-action-meta">
                    Czeka na odpowiedź
                    {item.createdAt ? (
                      <>
                        {" "}
                        ·{" "}
                        <span className="mono">
                          {DATE_FMT.format(new Date(item.createdAt))}
                        </span>
                      </>
                    ) : null}
                  </span>
                </span>
                {item.rating !== null ? (
                  <span
                    className={`ui-pill ${item.rating <= 3 ? "ui-pill-warn" : "ui-pill-neutral"}`}
                  >
                    <span className="mono">{item.rating}</span>★
                  </span>
                ) : null}
                <ChevronRight aria-hidden className="pulpit-action-go" />
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Link href="/opinie?status=pending" className="pulpit-card-foot">
        Zobacz wszystkie
        <ArrowUpRight aria-hidden />
      </Link>
    </section>
  );
}
