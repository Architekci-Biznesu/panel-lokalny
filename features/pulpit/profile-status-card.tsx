import { Calendar } from "lucide-react";
import type { PulpitStatus } from "@/features/pulpit/load-pulpit";

function MetricTicks({
  filled,
  total = 20,
  tone = "dark",
}: {
  filled: number;
  total?: number;
  tone?: "dark" | "warn" | "brand";
}) {
  const on = Math.max(0, Math.min(total, filled));
  return (
    <div className="pulpit-metric-ticks" aria-hidden>
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={`pulpit-metric-tick is-${tone}${i < on ? " is-on" : ""}`}
        />
      ))}
    </div>
  );
}

function formatAnalysisDate(iso: string | null): string {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleDateString("pl-PL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return "-";
  }
}

export function ProfileStatusCard({ status }: { status: PulpitStatus | null }) {
  const filled = status?.filledCount ?? 0;
  const total = status?.filledTotal ?? 10;
  const proposals = status?.pendingSuggestions ?? 0;
  const reviews = status?.newReviewsCount;

  return (
    <section className="pulpit-card pulpit-status">
      <header className="pulpit-status-head">
        <h2 className="pulpit-card-title">Stan wizytówki</h2>
        <p className="pulpit-status-analyzed">
          <Calendar aria-hidden />
          Ostatnia analiza:{" "}
          <span className="mono">
            {formatAnalysisDate(status?.lastAnalyzedAt ?? null)}
          </span>
        </p>
      </header>

      {!status ? (
        <p className="pulpit-empty">
          Podłącz wizytówkę Google, żeby zobaczyć stan profilu.
        </p>
      ) : (
        <div className="pulpit-status-grid">
          <div className="pulpit-metric">
            <p className="pulpit-metric-label">Kompletność profilu</p>
            <p className="pulpit-metric-value mono">
              {filled}/{total}
            </p>
            <MetricTicks filled={Math.round((filled / Math.max(total, 1)) * 20)} />
          </div>
          <div className="pulpit-metric">
            <p className="pulpit-metric-label">Propozycje AI</p>
            <p className="pulpit-metric-value mono">{proposals}</p>
            <MetricTicks
              filled={Math.min(20, proposals)}
              tone="warn"
            />
          </div>
          <div className="pulpit-metric">
            <p className="pulpit-metric-label">Nowe opinie</p>
            <p className="pulpit-metric-value mono">
              {reviews == null ? "-" : reviews}
            </p>
            {/* TODO Styl 4: podłączyć loader opinii */}
            <MetricTicks
              filled={reviews == null ? 0 : Math.min(20, reviews)}
              tone="dark"
            />
          </div>
        </div>
      )}
    </section>
  );
}
