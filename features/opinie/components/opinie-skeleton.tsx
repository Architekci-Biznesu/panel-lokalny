import { Star } from "lucide-react";
import { ModuleHeader } from "@/features/shell/module-header";
import {
  Skel,
  SkelButton,
  SkelCircle,
  SkelSubnav,
} from "@/features/shell/skeleton";
import { OPINIE_HEADER, OPINIE_TABS } from "@/features/opinie/module";
import {
  REVIEW_RATING_FILTERS,
  REVIEW_STATUS_FILTERS,
} from "@/features/opinie/review-filters";

// Heights below match the loaded blocks (measured at 1440 px), so the page
// does not jump when data arrives.

/** Opinie on first entry - the same containers as ReviewsWorkspace. */
export function OpinieSkeleton() {
  return (
    <div className="op-page" aria-busy="true" aria-label="Ładowanie opinii">
      <ModuleHeader {...OPINIE_HEADER} />
      <SkelSubnav tabs={OPINIE_TABS} />
      <div className="op-body">
        <div className="op-workspace">
          <div className="op-summary" style={{ minHeight: 220 }}>
            <section className="op-summary-card">
              <div className="op-summary-rating">
                <div className="op-summary-score">
                  <span className="op-summary-label">Średnia ocena</span>
                  <Skel w="4.5rem" h="2.75rem" />
                  <Skel w="6rem" h="1rem" />
                  <Skel w="8rem" />
                </div>
                <ol className="op-summary-bars" aria-hidden>
                  {[5, 4, 3, 2, 1].map((stars) => (
                    <li key={stars}>
                      <span className="op-summary-bar">
                        <span className="mono">{stars}</span>
                        <span className="op-summary-track" />
                        <span className="mono op-summary-count">-</span>
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
              <div className="op-summary-todo">
                <span className="op-summary-label">Do odpowiedzi</span>
                <Skel w="5rem" h="2.75rem" />
                <Skel w="9rem" />
                <Skel w="11rem" />
                <Skel w="100%" h="1.75rem" style={{ marginTop: 8 }} />
              </div>
            </section>
            <div className="op-setcard" aria-hidden>
              <span className="op-setcard-head">
                <span className="op-setcard-main">
                  <span className="op-summary-label">Tryb odpowiedzi</span>
                  <Skel w="7rem" h="1.25rem" />
                  <Skel w="90%" />
                  <Skel w="70%" />
                </span>
              </span>
              <span className="op-setcard-foot">
                <span>Styl</span>
                <Skel w="9rem" />
              </span>
            </div>
          </div>

          <div className="op-filters" aria-hidden>
            <nav className="ui-seg">
              {REVIEW_STATUS_FILTERS.map((filter, index) => (
                <span
                  key={filter.value}
                  className={`ui-seg-item${index === 0 ? " is-active" : ""}`}
                >
                  {filter.label}
                </span>
              ))}
            </nav>
            <nav className="ui-seg">
              {REVIEW_RATING_FILTERS.map((filter, index) => (
                <span
                  key={filter.value}
                  className={`ui-seg-item${index === 0 ? " is-active" : ""}`}
                >
                  {filter.label}
                  {filter.value === "all" ? null : (
                    <Star aria-hidden className="op-seg-star" />
                  )}
                </span>
              ))}
            </nav>
            <div className="op-sync">
              <Skel w="9rem" />
              <SkelButton w="6rem" small />
            </div>
          </div>

          <div className="op-list">
            <div className="op-list-head" aria-hidden>
              <span>Opinia klienta</span>
              <span>Twoja odpowiedź</span>
            </div>
            {[0, 1, 2].map((i) => (
              <div key={i} className="op-card" style={{ minHeight: 204 }}>
                <div className="op-card-review">
                  <div className="op-card-head">
                    <SkelCircle />
                    <div className="op-author">
                      <Skel w="9rem" h="0.875rem" />
                      <Skel w="7rem" />
                    </div>
                  </div>
                  <Skel w="100%" />
                  <Skel w="85%" />
                  <Skel w="60%" />
                </div>
                <div className="op-reply is-draft">
                  <Skel w="40%" />
                  <Skel w="100%" h="4.5rem" block />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
