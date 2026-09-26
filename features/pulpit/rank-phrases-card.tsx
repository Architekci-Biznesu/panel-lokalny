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

/** Gładka krzywa przez punkty (monotoniczna, bez "przestrzeliwania" jak w wykresie widoczności). */
function smoothPath(points: ReadonlyArray<readonly [number, number]>): string {
  const n = points.length;
  if (n < 2) return "";
  const dx: number[] = [];
  const slope: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx.push(points[i + 1]![0] - points[i]![0]);
    slope.push((points[i + 1]![1] - points[i]![1]) / dx[i]!);
  }
  const tangent: number[] = [slope[0]!];
  for (let i = 1; i < n - 1; i++) {
    const a = slope[i - 1]!;
    const b = slope[i]!;
    tangent.push(a * b <= 0 ? 0 : (2 * a * b) / (a + b));
  }
  tangent.push(slope[n - 2]!);
  let d = `M${points[0]![0].toFixed(1)},${points[0]![1].toFixed(1)}`;
  for (let i = 0; i < n - 1; i++) {
    const [x0, y0] = points[i]!;
    const [x1, y1] = points[i + 1]!;
    const h = dx[i]! / 3;
    d += ` C${(x0 + h).toFixed(1)},${(y0 + tangent[i]! * h).toFixed(1)} ${(x1 - h).toFixed(1)},${(y1 - tangent[i + 1]! * h).toFixed(1)} ${x1.toFixed(1)},${y1.toFixed(1)}`;
  }
  return d;
}

function AgrSparkline({
  id,
  series,
  falling,
}: {
  id: string;
  series: number[];
  falling: boolean;
}) {
  if (series.length < 2) {
    return <span className="pulpit-spark is-empty" aria-hidden />;
  }

  const width = 88;
  const height = 28;
  const pad = 3;
  const min = Math.min(...series);
  const max = Math.max(...series);
  const span = Math.max(max - min, 0.01);
  const coords = series.map((v, i) => {
    const x = pad + (i / (series.length - 1)) * (width - pad * 2);
    // Niższy AGR = lepiej, więc lepsze wartości rysujemy wyżej.
    const y = pad + ((v - min) / span) * (height - pad * 2);
    return [x, y] as const;
  });
  const line = smoothPath(coords);
  const first = coords[0]!;
  const [lastX, lastY] = coords[coords.length - 1]!;
  const area = `${line} L${lastX.toFixed(1)},${height} L${first[0].toFixed(1)},${height} Z`;
  const gradientId = `pulpit-spark-${id}`;

  return (
    <svg
      className={`pulpit-spark${falling ? " is-down" : " is-up"}`}
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      aria-hidden
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity={0.22} />
          <stop offset="100%" stopColor="currentColor" stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradientId})`} />
      <path
        d={line}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx={lastX}
        cy={lastY}
        r="2.75"
        fill="currentColor"
        stroke="var(--card)"
        strokeWidth="1.5"
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
        <div className="pulpit-title-row">
          <span className="pulpit-icon-circle" aria-hidden>
            <MapPinned />
          </span>
          <div>
            <h2 className="pulpit-card-title">Mapa pozycji</h2>
            <p className="pulpit-card-lead">
              Średnia pozycja (AGR) i trend z ostatnich skanów - im niżej, tym
              lepiej.
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
                  <AgrSparkline
                    id={item.id}
                    series={item.series}
                    falling={falling}
                  />
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
