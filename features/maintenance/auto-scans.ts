import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { profiles, rankKeywords, rankScans } from "@/lib/db/schema";
import {
  RANK_AUTO_SCAN_INTERVAL_DAYS,
  RANK_GRID_SIZE,
  RANK_ZOOM,
} from "@/lib/config/rank-limits";
import { enqueueRankScan } from "@/lib/queue";
import { scanLimitReason } from "@/features/wizytowka/rank/limits";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Once a day: keywords whose last done scan is older than
 * RANK_AUTO_SCAN_INTERVAL_DAYS are scanned again. Only keywords the customer
 * scanned by hand at least once - a keyword added and never checked costs
 * nothing. The same limits as "Skanuj teraz" are checked here and again by
 * the worker before ScrapingDog.
 */
export async function startDueAutoScans(now: Date = new Date()) {
  const cutoff = new Date(
    now.getTime() - RANK_AUTO_SCAN_INTERVAL_DAYS * DAY_MS,
  );

  const history = await db
    .select({
      keywordId: rankScans.keywordId,
      profileId: rankScans.profileId,
      lastDone: sql<Date | null>`max(${rankScans.startedAt}) filter (where ${rankScans.status} = 'done')`,
      manualDone: sql<boolean>`bool_or(${rankScans.trigger} = 'manual' and ${rankScans.status} = 'done')`,
    })
    .from(rankScans)
    .groupBy(rankScans.keywordId, rankScans.profileId);

  const due = history.filter(
    (row) =>
      row.manualDone &&
      row.lastDone !== null &&
      new Date(row.lastDone).getTime() < cutoff.getTime(),
  );
  if (due.length === 0) return { started: 0, skipped: 0 };

  // Only keywords that still exist, on profiles still connected to Google.
  const keywords = await db
    .select({
      id: rankKeywords.id,
      profileId: rankKeywords.profileId,
      radiusKm: rankKeywords.defaultRadiusKm,
    })
    .from(rankKeywords)
    .innerJoin(profiles, eq(profiles.id, rankKeywords.profileId))
    .where(
      and(
        inArray(
          rankKeywords.id,
          due.map((row) => row.keywordId),
        ),
        isNotNull(profiles.gbpLocationId),
        isNotNull(profiles.oauthConnectionId),
        isNotNull(profiles.gbpPlaceId),
      ),
    );

  let started = 0;
  let skipped = 0;
  for (const keyword of keywords) {
    if (await scanLimitReason(keyword.profileId, keyword.id, { now })) {
      skipped += 1;
      continue;
    }
    const [scan] = await db
      .insert(rankScans)
      .values({
        profileId: keyword.profileId,
        keywordId: keyword.id,
        gridSize: RANK_GRID_SIZE,
        radiusKm: keyword.radiusKm,
        zoom: RANK_ZOOM,
        status: "running",
        trigger: "auto",
      })
      .returning({ id: rankScans.id });
    await enqueueRankScan(scan.id);
    started += 1;
  }
  return { started, skipped };
}
