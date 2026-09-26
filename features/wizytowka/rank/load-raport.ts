import { and, desc, eq } from "drizzle-orm";
import {
  coerceStaleScanStatus,
  ensureGbpPlaceId,
  hasDoneScanTodayForKeyword,
  markStaleRunningScans,
  radiusKmNumber,
} from "@/features/wizytowka/rank";
import { RANK_TIMEZONE } from "@/lib/config/rank-limits";
import { db } from "@/lib/db";
import {
  rankKeywords,
  rankResults,
  rankScans,
  type LocalPackSnapshotItem,
  type RankKeyword,
  type RankResult,
  type RankScan,
} from "@/lib/db/schema";
import { getActiveGbpProfile } from "@/lib/integrations/gbp/access";

export type RankKeywordView = {
  id: string;
  phrase: string;
  defaultRadiusKm: number;
  createdAt: string;
  scannedToday: boolean;
  runningScanId: string | null;
  /** YYYY-MM-DD (Europe/Warsaw) days with a done scan */
  scanDays: string[];
};

export type RankScanView = {
  id: string;
  keywordId: string;
  phrase: string;
  status: RankScan["status"];
  gridSize: number;
  radiusKm: number;
  zoom: number;
  agr: number | null;
  atgr: number | null;
  localPackPosition: number | null;
  localPackResults: LocalPackSnapshotItem[];
  startedAt: string;
  finishedAt: string | null;
  error: string | null;
  results: Array<{
    lat: number;
    lng: number;
    position: number | null;
    matchMethod: RankResult["matchMethod"];
  }>;
  deltaAgr: number | null;
  deltaAtgr: number | null;
  deltaLocalPack: number | null;
};

export type RankRaportPayload = {
  placeId: string | null;
  businessName: string;
  keywords: RankKeywordView[];
  latestByKeyword: Record<string, RankScanView | null>;
  /** All done scans keyed by keywordId then by Warsaw day YYYY-MM-DD */
  scansByKeywordDay: Record<string, Record<string, RankScanView>>;
  activeScan: RankScanView | null;
};

function numOrNull(value: string | null): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function warsawDayKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: RANK_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function toScanView(
  scan: RankScan,
  phrase: string,
  results: RankResult[],
  previous: RankScan | null,
): RankScanView {
  const status = coerceStaleScanStatus(scan);
  const sameParams =
    previous &&
    previous.gridSize === scan.gridSize &&
    radiusKmNumber(previous.radiusKm) === radiusKmNumber(scan.radiusKm) &&
    previous.zoom === scan.zoom;

  const agr = numOrNull(scan.agr);
  const atgr = numOrNull(scan.atgr);
  const prevAgr = previous ? numOrNull(previous.agr) : null;
  const prevAtgr = previous ? numOrNull(previous.atgr) : null;

  return {
    id: scan.id,
    keywordId: scan.keywordId,
    phrase,
    status,
    gridSize: scan.gridSize,
    radiusKm: radiusKmNumber(scan.radiusKm),
    zoom: scan.zoom,
    agr,
    atgr,
    localPackPosition: scan.localPackPosition,
    localPackResults: Array.isArray(scan.localPackResults)
      ? scan.localPackResults
      : [],
    startedAt: scan.startedAt.toISOString(),
    finishedAt: scan.finishedAt?.toISOString() ?? null,
    error: scan.error,
    results: results.map((r) => ({
      lat: r.lat,
      lng: r.lng,
      position: r.position,
      matchMethod: r.matchMethod,
    })),
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
  };
}

async function loadScanBundle(
  scan: RankScan,
  phrase: string,
  allDoneForKeyword: RankScan[],
): Promise<RankScanView> {
  const results = await db
    .select()
    .from(rankResults)
    .where(eq(rankResults.scanId, scan.id));

  const previous =
    allDoneForKeyword.find(
      (s) =>
        s.id !== scan.id &&
        s.status === "done" &&
        (s.finishedAt?.getTime() ?? 0) <
          (scan.finishedAt?.getTime() ?? scan.startedAt.getTime()),
    ) ?? null;

  return toScanView(scan, phrase, results, previous);
}

export async function loadRankRaportPayload(
  preferredKeywordId?: string | null,
): Promise<RankRaportPayload> {
  let profile = await getActiveGbpProfile();
  profile = await ensureGbpPlaceId(profile);
  await markStaleRunningScans(profile.id);

  const keywords = await db
    .select()
    .from(rankKeywords)
    .where(eq(rankKeywords.profileId, profile.id))
    .orderBy(desc(rankKeywords.createdAt));

  const keywordViews: RankKeywordView[] = [];
  const latestByKeyword: Record<string, RankScanView | null> = {};
  const scansByKeywordDay: Record<string, Record<string, RankScanView>> = {};
  let activeScan: RankScanView | null = null;

  for (const keyword of keywords) {
    const scans = await db
      .select()
      .from(rankScans)
      .where(
        and(
          eq(rankScans.profileId, profile.id),
          eq(rankScans.keywordId, keyword.id),
        ),
      )
      .orderBy(desc(rankScans.startedAt));

    const running = scans.find((s) => coerceStaleScanStatus(s) === "running");
    const doneScans = scans.filter((s) => s.status === "done");
    const latestDone = doneScans[0] ?? null;

    const scannedToday = await hasDoneScanTodayForKeyword(
      profile.id,
      keyword.id,
    );

    const dayMap: Record<string, RankScanView> = {};
    const scanDays: string[] = [];

    for (const done of doneScans) {
      const day = warsawDayKey(done.finishedAt ?? done.startedAt);
      if (dayMap[day]) continue;
      dayMap[day] = await loadScanBundle(done, keyword.phrase, doneScans);
      scanDays.push(day);
    }
    scansByKeywordDay[keyword.id] = dayMap;

    keywordViews.push({
      id: keyword.id,
      phrase: keyword.phrase,
      defaultRadiusKm: radiusKmNumber(keyword.defaultRadiusKm),
      createdAt: keyword.createdAt.toISOString(),
      scannedToday,
      runningScanId: running?.id ?? null,
      scanDays,
    });

    if (latestDone) {
      latestByKeyword[keyword.id] =
        dayMap[warsawDayKey(latestDone.finishedAt ?? latestDone.startedAt)] ??
        (await loadScanBundle(latestDone, keyword.phrase, doneScans));
    } else {
      latestByKeyword[keyword.id] = null;
    }

    if (running) {
      const view = await loadScanBundle(running, keyword.phrase, doneScans);
      if (
        !activeScan ||
        (preferredKeywordId && keyword.id === preferredKeywordId)
      ) {
        activeScan = view;
      }
    }
  }

  const selectedKeywordId =
    preferredKeywordId && keywordViews.some((k) => k.id === preferredKeywordId)
      ? preferredKeywordId
      : keywordViews[0]?.id;

  if (!activeScan && selectedKeywordId) {
    activeScan = latestByKeyword[selectedKeywordId] ?? null;
  }

  return {
    placeId: profile.gbpPlaceId,
    businessName: profile.name,
    keywords: keywordViews,
    latestByKeyword,
    scansByKeywordDay,
    activeScan,
  };
}

export type { RankKeyword };
