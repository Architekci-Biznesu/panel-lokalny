"use client";

import { Languages } from "lucide-react";
import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ReviewReply } from "@/features/opinie/components/review-reply";
import { ReviewStars } from "@/features/opinie/components/review-stars";
import type { ReviewItem } from "@/features/opinie/load-reviews";

const DATE_FMT = new Intl.DateTimeFormat("pl-PL", {
  day: "numeric",
  month: "short",
  year: "numeric",
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

/** One review: who wrote it, what, and the reply area (draft / published / none). */
export function ReviewCard({ item }: { item: ReviewItem }) {
  const [showTranslation, setShowTranslation] = useState(false);
  const name = item.authorName.trim() || "Użytkownik Google";
  const text =
    showTranslation && item.translated ? item.translated : item.original;

  return (
    <article
      className={`op-card${item.urgent ? " is-urgent" : ""}`}
      id={`op-review-${item.id}`}
    >
      <div className="op-card-review">
        <header className="op-card-head">
          <Avatar className="op-avatar">
            {item.authorPhotoUrl ? (
              <AvatarImage src={item.authorPhotoUrl} alt="" />
            ) : null}
            <AvatarFallback>{initials(name)}</AvatarFallback>
          </Avatar>
          <div className="op-author">
            <p className="op-author-name">{name}</p>
            <p className="op-meta">
              <ReviewStars rating={item.rating} />
              {item.createdAt ? (
                <span className="mono">
                  {DATE_FMT.format(new Date(item.createdAt))}
                </span>
              ) : null}
            </p>
          </div>
          <div className="op-flags">
            {item.urgent ? (
              <span
                className="ui-pill op-flag"
                title="Niska ocena bez odpowiedzi - warto odpowiedzieć szybko"
              >
                <span className="op-dot is-low" aria-hidden />
                Ocena 1-2
              </span>
            ) : null}
            {item.changedAfterReply ? (
              <span
                className="ui-pill op-flag"
                title="Autor zmienił opinię już po odpowiedzi - sprawdź, czy odpowiedź nadal pasuje"
              >
                Zmieniona po odpowiedzi
              </span>
            ) : null}
          </div>
        </header>

        {text ? (
          <div className="op-content">
            <p className="op-text">{text}</p>
            {item.translated ? (
              <button
                type="button"
                className="op-toggle"
                onClick={() => setShowTranslation((value) => !value)}
              >
                <Languages aria-hidden />
                {showTranslation
                  ? "Pokaż oryginał"
                  : "Opinia w innym języku - pokaż tłumaczenie"}
              </button>
            ) : null}
          </div>
        ) : (
          <p className="op-text is-empty">
            Autor wystawił same gwiazdki, bez treści.
          </p>
        )}
      </div>

      <ReviewReply item={item} />
    </article>
  );
}
