import { and, eq, gte, lt } from "drizzle-orm";
import { RANK_STALE_RUNNING_MS, RANK_TIMEZONE } from "@/lib/config/rank-limits";
import { db } from "@/lib/db";
import { rankScans, type RankScan } from "@/lib/db/schema";

/** Calendar day bounds in Europe/Warsaw as UTC Date objects. */
export function warsawDayBounds(now: Date = new Date()): {
  startUtc: Date;
  endUtc: Date;
  dayKey: string;
} {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: RANK_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const dayKey = formatter.format(now);

  // Approximate: find UTC instants for midnight Warsaw via binary-ish offset probe
  const startUtc = warsawMidnightUtc(dayKey);
  const next = nextDayKey(dayKey);
  const endUtc = warsawMidnightUtc(next);
  return { startUtc, endUtc, dayKey };
}

function nextDayKey(dayKey: string): string {
  const [y, m, d] = dayKey.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + 1);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

/**
 * Convert a YYYY-MM-DD calendar date in Europe/Warsaw to the UTC instant
 * when that local midnight occurs.
 */
function warsawMidnightUtc(dayKey: string): Date {
  const [y, m, d] = dayKey.split("-").map(Number);
  // Guess UTC noon then adjust by observed Warsaw offset at that moment
  const guess = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: RANK_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(guess);
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? "0");
  const localAsUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second"),
  );
  const offsetMs = localAsUtc - guess.getTime();
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0) - offsetMs);
}

export async function markStaleRunningScans(
  profileId: string,
  now: Date = new Date(),
): Promise<void> {
  const cutoff = new Date(now.getTime() - RANK_STALE_RUNNING_MS);
  await db
    .update(rankScans)
    .set({
      status: "failed",
      error: "Skan wygasł (przekroczono 15 minut)",
      finishedAt: now,
    })
    .where(
      and(
        eq(rankScans.profileId, profileId),
        eq(rankScans.status, "running"),
        lt(rankScans.startedAt, cutoff),
      ),
    );
}

export async function hasRunningScanForKeyword(
  profileId: string,
  keywordId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: rankScans.id })
    .from(rankScans)
    .where(
      and(
        eq(rankScans.profileId, profileId),
        eq(rankScans.keywordId, keywordId),
        eq(rankScans.status, "running"),
      ),
    )
    .limit(1);
  return Boolean(row);
}

export async function hasDoneScanTodayForKeyword(
  profileId: string,
  keywordId: string,
  now: Date = new Date(),
): Promise<boolean> {
  const { startUtc, endUtc } = warsawDayBounds(now);
  const [row] = await db
    .select({ id: rankScans.id })
    .from(rankScans)
    .where(
      and(
        eq(rankScans.profileId, profileId),
        eq(rankScans.keywordId, keywordId),
        eq(rankScans.status, "done"),
        gte(rankScans.startedAt, startUtc),
        lt(rankScans.startedAt, endUtc),
      ),
    )
    .limit(1);
  return Boolean(row);
}

export function coerceStaleScanStatus(
  scan: Pick<RankScan, "status" | "startedAt">,
  now: Date = new Date(),
): RankScan["status"] {
  if (scan.status !== "running") return scan.status;
  if (now.getTime() - scan.startedAt.getTime() > RANK_STALE_RUNNING_MS) {
    return "failed";
  }
  return "running";
}

/** Next Warsaw midnight as Date (for UI "available tomorrow" messaging). */
export function nextWarsawMidnight(now: Date = new Date()): Date {
  const { endUtc } = warsawDayBounds(now);
  return endUtc;
}

export function radiusKmNumber(value: string | number): number {
  return typeof value === "number" ? value : Number(value);
}
