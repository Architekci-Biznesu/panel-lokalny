import type { CompletenessSummary } from "@/features/wizytowka/completeness";

function formatDate(date: Date | null): string {
  if (!date) return "jeszcze nie";
  return new Intl.DateTimeFormat("pl-PL", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function CompletenessBar({ summary }: { summary: CompletenessSummary }) {
  return (
    <div className="wiz-completeness" aria-label="Podsumowanie kompletności">
      <div className="wiz-completeness-item">
        <span className="wiz-completeness-value mono">
          {summary.filledCount}/{summary.filledTotal}
        </span>
        <span className="wiz-completeness-label">pól wypełnionych</span>
      </div>
      <div className="wiz-completeness-item">
        <span className="wiz-completeness-value mono">
          {summary.pendingSuggestions}
        </span>
        <span className="wiz-completeness-label">propozycji do decyzji</span>
      </div>
      <div className="wiz-completeness-item">
        <span className="wiz-completeness-value mono">
          {summary.factsToConfirm}
        </span>
        <span className="wiz-completeness-label">faktów do potwierdzenia</span>
      </div>
      <div className="wiz-completeness-item">
        <span className="wiz-completeness-value mono">
          {formatDate(summary.lastAnalyzedAt)}
        </span>
        <span className="wiz-completeness-label">ostatnia analiza</span>
      </div>
    </div>
  );
}
