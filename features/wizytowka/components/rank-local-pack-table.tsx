"use client";

import { Star } from "lucide-react";
import type { LocalPackSnapshotItem } from "@/lib/db/schema";

export function RankLocalPackTable({
  rows,
  ownPlaceId,
  ownPosition,
  errorHint = null,
}: {
  rows: LocalPackSnapshotItem[];
  ownPlaceId: string | null;
  ownPosition: number | null;
  errorHint?: string | null;
}) {
  const localPackError = errorHint
    ?.split(";")
    .map((s) => s.trim())
    .find((s) => s.toLowerCase().startsWith("local pack"));

  return (
    <section className="ui-section rank-local-pack">
      <header className="ui-section-header">
        <h3 className="ui-section-title">Ranking w wyszukiwarce Google</h3>
        {ownPosition != null ? (
          <span className="ui-pill ui-pill-info">
            Twoja pozycja: <span className="mono">{ownPosition}</span>
          </span>
        ) : null}
      </header>

      {rows.length === 0 ? (
        <div className="ui-section-body">
          <p className="rank-local-pack-empty">
            {localPackError
              ? localPackError
              : "Nie udało się pobrać listy firm z Local Packu. Mapa siatki działa osobno - spróbuj ponowić skan później."}
          </p>
        </div>
      ) : (
        <div className="ui-section-body rank-local-pack-body">
          <div className="rank-local-pack-table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col" className="rank-local-pack-col-pos">
                    #
                  </th>
                  <th scope="col">Firma</th>
                  <th scope="col" className="rank-local-pack-col-num">
                    Ocena
                  </th>
                  <th scope="col" className="rank-local-pack-col-num">
                    Opinie
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const isOwn =
                    (ownPlaceId && row.placeId && row.placeId === ownPlaceId) ||
                    (ownPosition != null && row.position === ownPosition);
                  return (
                    <tr
                      key={`${row.position}-${row.placeId ?? row.title}`}
                      className={isOwn ? "is-own" : undefined}
                    >
                      <td className="mono rank-local-pack-pos">
                        {row.position}
                      </td>
                      <td>
                        <div className="rank-local-pack-firm">
                          <span className="rank-local-pack-name">
                            {row.title}
                          </span>
                          {isOwn ? (
                            <span className="ui-pill ui-pill-info">Ty</span>
                          ) : null}
                        </div>
                      </td>
                      <td className="mono rank-local-pack-col-num rank-local-pack-rating">
                        {row.rating != null ? (
                          <span className="rank-local-pack-rating-inner">
                            <Star
                              aria-hidden
                              className="rank-local-pack-star"
                            />
                            {row.rating.toLocaleString("pl-PL", {
                              minimumFractionDigits: 1,
                              maximumFractionDigits: 1,
                            })}
                          </span>
                        ) : (
                          <span className="rank-local-pack-dash">-</span>
                        )}
                      </td>
                      <td className="mono rank-local-pack-col-num rank-local-pack-reviews">
                        {row.reviews != null
                          ? row.reviews.toLocaleString("pl-PL")
                          : "-"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
