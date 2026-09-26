import Link from "next/link";
import { ArrowRight, CircleAlert } from "lucide-react";
import type { CompletenessSummary } from "@/features/wizytowka/completeness";

function gapActionLabel(gap: CompletenessSummary["outsidePanelGaps"][number]) {
  if (gap.id === "photos") return "Otwórz w Google";
  if (gap.id === "pending_edits") return "Sprawdź status";
  return "Przejdź";
}

export function OutsideGaps({
  gaps,
  mapsUri = null,
}: {
  gaps: CompletenessSummary["outsidePanelGaps"];
  mapsUri?: string | null;
}) {
  if (gaps.length === 0) return null;

  return (
    <ul className="wiz-gaps-list">
      {gaps.map((gap) => {
        const href =
          gap.href ??
          (gap.id === "photos" || gap.id === "pending_edits"
            ? mapsUri?.trim() || null
            : null);
        const external = Boolean(href && /^https?:\/\//i.test(href));
        const action = gapActionLabel(gap);

        const body = (
          <>
            <span className="wiz-gap-icon" aria-hidden>
              <CircleAlert />
            </span>
            <div className="wiz-gap-copy">
              <p className="wiz-gap-title">{gap.label}</p>
              <p className="wiz-gap-why">{gap.why}</p>
            </div>
            {href ? (
              <span className="wiz-gap-action">
                {action}
                <ArrowRight aria-hidden />
              </span>
            ) : null}
          </>
        );

        return (
          <li key={gap.id} className="wiz-gap-banner">
            {href ? (
              external ? (
                <a
                  href={href}
                  className="wiz-gap-link"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {body}
                </a>
              ) : (
                <Link href={href} className="wiz-gap-link">
                  {body}
                </Link>
              )
            ) : (
              <div className="wiz-gap-link">{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
