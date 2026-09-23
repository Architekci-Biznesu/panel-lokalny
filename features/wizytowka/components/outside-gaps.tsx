import Link from "next/link";
import { CircleAlert } from "lucide-react";
import type { CompletenessSummary } from "@/features/wizytowka/completeness";

export function OutsideGaps({
  gaps,
}: {
  gaps: CompletenessSummary["outsidePanelGaps"];
}) {
  if (gaps.length === 0) return null;

  return (
    <ul className="wiz-gaps-list">
      {gaps.map((gap) => {
        const body = (
          <>
            <span className="wiz-gap-icon" aria-hidden>
              <CircleAlert />
            </span>
            <div>
              <p className="wiz-gap-title">{gap.label}</p>
              <p className="wiz-gap-why">{gap.why}</p>
            </div>
          </>
        );

        return (
          <li key={gap.id} className="wiz-gap-banner">
            {gap.href ? (
              <Link href={gap.href} className="wiz-gap-link">
                {body}
              </Link>
            ) : (
              <div className="wiz-gap-link">{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
