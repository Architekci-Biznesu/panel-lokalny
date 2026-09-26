"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowUpRight, MapPinned } from "lucide-react";
import type { PulpitRankSnapshot } from "@/features/pulpit/load-pulpit-rank";

const RankMap = dynamic(
  () =>
    import("@/features/wizytowka/components/rank-map").then((m) => m.RankMap),
  { ssr: false },
);

function formatMetric(value: number | null, digits = 1): string {
  if (value == null) return "-";
  return value.toLocaleString("pl-PL", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  });
}

function Delta({
  value,
  invert = false,
}: {
  value: number | null;
  invert?: boolean;
}) {
  if (value == null) return null;
  const good = invert ? value < 0 : value > 0;
  const bad = invert ? value > 0 : value < 0;
  const label =
    value === 0
      ? "0"
      : `${value > 0 ? "+" : ""}${value.toLocaleString("pl-PL", {
          maximumFractionDigits: 1,
        })}`;
  return (
    <span
      className={`pulpit-rank-delta mono${good ? " is-good" : ""}${bad ? " is-bad" : ""}`}
    >
      {label}
    </span>
  );
}

export function RankSnapshotCard({
  rank,
}: {
  rank: PulpitRankSnapshot | null;
}) {
  return (
    <section className="pulpit-card pulpit-rank">
      <header className="pulpit-card-head">
        <div className="pulpit-visibility-title-row">
          <span className="pulpit-icon-circle" aria-hidden>
            <MapPinned />
          </span>
          <div>
            <h2 className="pulpit-card-title">Mapa pozycji</h2>
            <p className="pulpit-card-lead">
              {rank
                ? `Ostatni skan · ${rank.phrase}`
                : "Skrót z ostatniego skanu pozycji lokalnych."}
            </p>
          </div>
        </div>
        <Link href="/wizytowka/raporty" className="pulpit-card-cta">
          Pełny raport
          <ArrowUpRight aria-hidden />
        </Link>
      </header>

      {!rank ? (
        <p className="pulpit-empty">
          Brak skanu pozycji. Uruchom skan w{" "}
          <Link href="/wizytowka/raporty" className="wiz-inline-link">
            Raportach
          </Link>
          .
        </p>
      ) : (
        <div className="pulpit-rank-body">
          <div className="pulpit-rank-metrics">
            <div className="pulpit-rank-metric">
              <p className="pulpit-kpi-label">AGR</p>
              <p className="pulpit-kpi-value mono">
                {formatMetric(rank.agr, 2)}
              </p>
              <Delta value={rank.deltaAgr} />
            </div>
            <div className="pulpit-rank-metric">
              <p className="pulpit-kpi-label">ATGR</p>
              <p className="pulpit-kpi-value mono">
                {formatMetric(rank.atgr, 2)}
              </p>
              <Delta value={rank.deltaAtgr} />
            </div>
            <div className="pulpit-rank-metric">
              <p className="pulpit-kpi-label">Local Pack</p>
              <p className="pulpit-kpi-value mono">
                {rank.localPackPosition != null
                  ? `poz. ${rank.localPackPosition}`
                  : "-"}
              </p>
              <Delta value={rank.deltaLocalPack} invert />
            </div>
          </div>
          <RankMap
            points={rank.points}
            className="rank-map pulpit-rank-map"
            canvasHeight={260}
          />
        </div>
      )}
    </section>
  );
}
