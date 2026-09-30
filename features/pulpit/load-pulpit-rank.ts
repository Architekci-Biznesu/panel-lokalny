import { and, asc, desc, eq, lte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { rankKeywords, rankScans, type Profile } from "@/lib/db/schema";

export type PulpitRankPhrase = {
  id: string;
  phrase: string;
  agr: number | null;
  deltaAgr: number | null;
  /** AGR z ostatnich skanów (stare → nowe), max 12. */
  series: number[];
};

function numOrNull(value: string | null): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

const SERIES_LIMIT = 12;

/** Lista fraz z AGR, deltą i serią do sparkline - bez mapy / wyników punktów. */
export async function loadPulpitRankPhrases(
  profile: Profile,
): Promise<PulpitRankPhrase[]> {
  // Last SERIES_LIMIT finished scans of every phrase, in one query.
  const ranked = db
    .select({
      keywordId: rankScans.keywordId,
      agr: rankScans.agr,
      finishedAt: rankScans.finishedAt,
      startedAt: rankScans.startedAt,
      rn: sql<number>`row_number() over (partition by ${rankScans.keywordId} order by ${rankScans.finishedAt} desc nulls last, ${rankScans.startedAt} desc)`.as(
        "rn",
      ),
    })
    .from(rankScans)
    .where(
      and(eq(rankScans.profileId, profile.id), eq(rankScans.status, "done")),
    )
    .as("ranked");

  const [keywords, scans] = await Promise.all([
    db
      .select()
      .from(rankKeywords)
      .where(eq(rankKeywords.profileId, profile.id))
      .orderBy(asc(rankKeywords.createdAt)),
    db
      .select({ keywordId: ranked.keywordId, agr: ranked.agr, rn: ranked.rn })
      .from(ranked)
      .where(lte(ranked.rn, SERIES_LIMIT))
      .orderBy(asc(ranked.keywordId), desc(ranked.rn)),
  ]);

  const byKeyword = new Map<string, Array<string | null>>();
  for (const scan of scans) {
    // Chronological (old -> new): rows come with rn descending.
    const list = byKeyword.get(scan.keywordId) ?? [];
    list.push(scan.agr);
    byKeyword.set(scan.keywordId, list);
  }

  return keywords.map((keyword) => {
    const chronological = byKeyword.get(keyword.id) ?? [];
    if (chronological.length === 0) {
      return {
        id: keyword.id,
        phrase: keyword.phrase,
        agr: null,
        deltaAgr: null,
        series: [],
      };
    }

    const series = chronological
      .map((agr) => numOrNull(agr))
      .filter((n): n is number => n != null);
    const latest = numOrNull(chronological[chronological.length - 1]);
    const previous =
      chronological.length > 1
        ? numOrNull(chronological[chronological.length - 2])
        : null;

    return {
      id: keyword.id,
      phrase: keyword.phrase,
      agr: latest,
      deltaAgr: latest != null && previous != null ? latest - previous : null,
      series,
    };
  });
}
