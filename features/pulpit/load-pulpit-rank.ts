import { and, desc, eq } from "drizzle-orm";
import { radiusKmNumber } from "@/features/wizytowka/rank";
import { db } from "@/lib/db";
import { rankKeywords, rankResults, rankScans } from "@/lib/db/schema";
import { getActiveGbpProfile } from "@/lib/integrations/gbp/access";

export type PulpitRankPoint = {
  lat: number;
  lng: number;
  position: number | null;
};

export type PulpitRankSnapshot = {
  phrase: string;
  agr: number | null;
  atgr: number | null;
  localPackPosition: number | null;
  deltaAgr: number | null;
  deltaAtgr: number | null;
  deltaLocalPack: number | null;
  points: PulpitRankPoint[];
  finishedAt: string | null;
};

function numOrNull(value: string | null): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Lekki snapshot: najnowszy skan done + punkty mapy. Bez historii kalendarza. */
export async function loadPulpitRankSnapshot(): Promise<PulpitRankSnapshot | null> {
  const profile = await getActiveGbpProfile();

  const [latest] = await db
    .select({
      scan: rankScans,
      phrase: rankKeywords.phrase,
    })
    .from(rankScans)
    .innerJoin(rankKeywords, eq(rankKeywords.id, rankScans.keywordId))
    .where(
      and(eq(rankScans.profileId, profile.id), eq(rankScans.status, "done")),
    )
    .orderBy(desc(rankScans.finishedAt), desc(rankScans.startedAt))
    .limit(1);

  if (!latest) return null;

  const { scan, phrase } = latest;
  const results = await db
    .select({
      lat: rankResults.lat,
      lng: rankResults.lng,
      position: rankResults.position,
    })
    .from(rankResults)
    .where(eq(rankResults.scanId, scan.id));

  const previousRows = await db
    .select()
    .from(rankScans)
    .where(
      and(
        eq(rankScans.profileId, profile.id),
        eq(rankScans.keywordId, scan.keywordId),
        eq(rankScans.status, "done"),
      ),
    )
    .orderBy(desc(rankScans.finishedAt), desc(rankScans.startedAt))
    .limit(5);

  const previous =
    previousRows.find(
      (s) =>
        s.id !== scan.id &&
        (s.finishedAt?.getTime() ?? 0) <
          (scan.finishedAt?.getTime() ?? scan.startedAt.getTime()),
    ) ?? null;

  const sameParams =
    previous != null &&
    previous.gridSize === scan.gridSize &&
    radiusKmNumber(previous.radiusKm) === radiusKmNumber(scan.radiusKm) &&
    previous.zoom === scan.zoom;

  const agr = numOrNull(scan.agr);
  const atgr = numOrNull(scan.atgr);
  const prevAgr = previous ? numOrNull(previous.agr) : null;
  const prevAtgr = previous ? numOrNull(previous.atgr) : null;

  return {
    phrase,
    agr,
    atgr,
    localPackPosition: scan.localPackPosition,
    deltaAgr:
      sameParams && agr != null && prevAgr != null ? agr - prevAgr : null,
    deltaAtgr:
      sameParams && atgr != null && prevAtgr != null ? atgr - prevAtgr : null,
    deltaLocalPack:
      sameParams &&
      scan.localPackPosition != null &&
      previous?.localPackPosition != null
        ? scan.localPackPosition - previous.localPackPosition
        : null,
    points: results.map((r) => ({
      lat: r.lat,
      lng: r.lng,
      position: r.position,
    })),
    finishedAt: scan.finishedAt?.toISOString() ?? null,
  };
}
