import type { CompletenessSummary } from "@/features/wizytowka/completeness";

export function OutsideGaps({
  gaps,
}: {
  gaps: CompletenessSummary["outsidePanelGaps"];
}) {
  if (gaps.length === 0) return null;

  return (
    <div className="wiz-gaps">
      <h2 className="text-base font-semibold">Do uzupełnienia poza panelem</h2>
      <ul className="wiz-gaps-list">
        {gaps.map((gap) => (
          <li key={gap.id} className="wiz-gap-item">
            <span className="ui-pill ui-pill-neutral">Poza panelem</span>
            <p className="mt-1 font-medium">{gap.label}</p>
            <p className="text-sm text-muted-foreground">{gap.why}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
