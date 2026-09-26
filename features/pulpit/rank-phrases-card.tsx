import Link from "next/link";
import { ArrowUpRight, MapPinned } from "lucide-react";
import type { PulpitRankPhrase } from "@/features/pulpit/load-pulpit-rank";

function formatAgr(value: number | null): string {
  if (value == null) return "-";
  return value.toLocaleString("pl-PL", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  });
}

function AgrSparkline({
  series,
  falling,
}: {
  series: number[];
  falling: boolean;
}) {
  if (series.length < 2) {
    return <span className="pulpit-spark is-empty" aria-hidden />;
  }

  const width = 88;
  const height = 28;
  const min = Math.min(...series);
  const max = Math.max(...series);
  const span = Math.max(max - min, 0.01);
  const pts = series
    .map((v, i) => {
      const x = (i / (series.length - 1)) * width;
      const y = height - ((v - min) / span) * (height - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg
      className={`pulpit-spark${falling ? " is-down" : " is-up"}`}
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      aria-hidden
    >
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={pts}
      />
    </svg>
  );
}

function DeltaPill({ value }: { value: number | null }) {
  if (value == null) {
    return <span className="pulpit-phrase-delta is-neutral">-</span>;
  }
  // Wyższy AGR = gorzej (dalsza pozycja)
  const worse = value > 0;
  const better = value < 0;
  const label =
    value === 0
      ? "0"
      : `${value > 0 ? "+" : ""}${value.toLocaleString("pl-PL", {
          maximumFractionDigits: 1,
        })}`;
  return (
    <span
      className={`pulpit-phrase-delta mono${worse ? " is-bad" : ""}${better ? " is-good" : ""}`}
    >
      {worse ? "↓ " : better ? "↑ " : ""}
      {label}
    </span>
  );
}

export function RankPhrasesCard({ phrases }: { phrases: PulpitRankPhrase[] }) {
  const withScans = phrases.filter((p) => p.series.length > 0 || p.agr != null);

  return (
    <section className="pulpit-card pulpit-phrases">
      <header className="pulpit-card-head">
        <div className="pulpit-visibility-title-row">
          <span className="pulpit-icon-circle" aria-hidden>
            <MapPinned />
          </span>
          <div>
            <h2 className="pulpit-card-title">Mapa pozycji</h2>
            <p className="pulpit-card-lead">
              Hasła i trend AGR z ostatnich skanów.
            </p>
          </div>
        </div>
        <Link href="/wizytowka/raporty" className="pulpit-card-cta">
          Pełny raport
          <ArrowUpRight aria-hidden />
        </Link>
      </header>

      {withScans.length === 0 ? (
        <p className="pulpit-empty">
          Brak skanów pozycji. Uruchom skan w{" "}
          <Link href="/wizytowka/raporty" className="wiz-inline-link">
            Raportach
          </Link>
          .
        </p>
      ) : (
        <>
          <div className="pulpit-phrase-head" aria-hidden>
            <span>Fraza</span>
            <span>AGR</span>
            <span>Zmiana</span>
            <span>Trend</span>
          </div>
          <ul className="pulpit-phrase-list">
            {phrases.map((item) => {
              const falling =
                item.deltaAgr != null
                  ? item.deltaAgr > 0
                  : item.series.length >= 2
                    ? item.series[item.series.length - 1]! > item.series[0]!
                    : false;
              return (
                <li key={item.id} className="pulpit-phrase-row">
                  <span className="pulpit-phrase-name">{item.phrase}</span>
                  <span className="pulpit-phrase-agr mono">
                    {formatAgr(item.agr)}
                  </span>
                  <DeltaPill value={item.deltaAgr} />
                  <AgrSparkline series={item.series} falling={falling} />
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
