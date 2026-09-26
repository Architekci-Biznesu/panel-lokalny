import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { rankKeywords, rankScans } from "@/lib/db/schema";
import { getActiveGbpProfile } from "@/lib/integrations/gbp/access";

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
export async function loadPulpitRankPhrases(): Promise<PulpitRankPhrase[]> {
  const profile = await getActiveGbpProfile();

  const keywords = await db
    .select()
    .from(rankKeywords)
    .where(eq(rankKeywords.profileId, profile.id))
    .orderBy(asc(rankKeywords.createdAt));

  const phrases: PulpitRankPhrase[] = [];

  for (const keyword of keywords) {
    const recentDesc = await db
      .select({
        agr: rankScans.agr,
        finishedAt: rankScans.finishedAt,
        startedAt: rankScans.startedAt,
      })
      .from(rankScans)
      .where(
        and(
          eq(rankScans.profileId, profile.id),
          eq(rankScans.keywordId, keyword.id),
          eq(rankScans.status, "done"),
        ),
      )
      .orderBy(desc(rankScans.finishedAt), desc(rankScans.startedAt))
      .limit(SERIES_LIMIT);

    if (recentDesc.length === 0) {
      phrases.push({
        id: keyword.id,
        phrase: keyword.phrase,
        agr: null,
        deltaAgr: null,
        series: [],
      });
      continue;
    }

    const chronological = [...recentDesc].reverse();
    const series = chronological
      .map((s) => numOrNull(s.agr))
      .filter((n): n is number => n != null);

    const latest = numOrNull(recentDesc[0].agr);
    const previous =
      recentDesc.length > 1 ? numOrNull(recentDesc[1].agr) : null;
    const deltaAgr =
      latest != null && previous != null ? latest - previous : null;

    phrases.push({
      id: keyword.id,
      phrase: keyword.phrase,
      agr: latest,
      deltaAgr,
      series,
    });
  }

  return phrases;
}
