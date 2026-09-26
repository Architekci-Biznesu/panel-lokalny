function formatAnalyzedAt(iso: string | null): string {
  if (!iso) return "jeszcze nie";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "jeszcze nie";
  return new Intl.DateTimeFormat("pl-PL", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function LastAnalysisLabel({ iso }: { iso: string | null }) {
  return (
    <p className="wiz-last-analysis">
      Ostatnia analiza:{" "}
      <span className="mono">{formatAnalyzedAt(iso)}</span>
    </p>
  );
}
