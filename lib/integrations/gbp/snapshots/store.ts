import { and, eq, gt, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  gbpSnapshots,
  type GbpSnapshot,
  type GbpSnapshotKind,
} from "@/lib/db/schema";
import { GBP_REFRESH_LOCK_MS } from "@/lib/config/freshness";

/**
 * Database side of Google snapshots. No session and no next/* - the
 * background refresh uses it too. Callers pass the profile id they already
 * checked (`getActiveProfile()` for pages, the claimed row for the refresh).
 */

/** One snapshot row: per profile, or shared (`profileId: null`) for public dictionaries. */
export type SnapshotTarget = {
  profileId: string | null;
  kind: GbpSnapshotKind;
  key: string;
};

/** Public Google dictionaries - the same for every profile, never listing data. */
export const SHARED_SNAPSHOT_KINDS: ReadonlySet<GbpSnapshotKind> = new Set([
  "categories",
  "attribute_metadata",
]);

function matches(target: SnapshotTarget) {
  return and(
    target.profileId === null
      ? isNull(gbpSnapshots.profileId)
      : eq(gbpSnapshots.profileId, target.profileId),
    eq(gbpSnapshots.kind, target.kind),
    eq(gbpSnapshots.key, target.key),
  );
}

function lockCutoff(): Date {
  return new Date(Date.now() - GBP_REFRESH_LOCK_MS);
}

export function isRefreshing(row: Pick<GbpSnapshot, "refreshingSince">) {
  return row.refreshingSince != null && row.refreshingSince > lockCutoff();
}

export async function getSnapshot(
  target: SnapshotTarget,
): Promise<GbpSnapshot | null> {
  const [row] = await db
    .select()
    .from(gbpSnapshots)
    .where(matches(target))
    .limit(1);
  return row ?? null;
}

/** Saves fresh data from Google and ends any refresh of this row. */
export async function putSnapshot(
  target: SnapshotTarget,
  data: unknown,
  fetchedAt: Date = new Date(),
): Promise<void> {
  await db
    .insert(gbpSnapshots)
    .values({ ...target, data, fetchedAt, refreshingSince: null })
    .onConflictDoUpdate({
      target: [gbpSnapshots.profileId, gbpSnapshots.kind, gbpSnapshots.key],
      set: { data, fetchedAt, refreshingSince: null },
    });
}

/**
 * Marks the row as being refreshed. Only one caller wins: the update only
 * matches while nobody else refreshes it (or their refresh looks dead).
 * Ten open tabs of the same profile give one request to Google.
 */
export async function claimSnapshotRefresh(
  target: SnapshotTarget,
): Promise<boolean> {
  const claimed = await db
    .update(gbpSnapshots)
    .set({ refreshingSince: sql`now()` })
    .where(
      and(
        matches(target),
        or(
          isNull(gbpSnapshots.refreshingSince),
          lt(gbpSnapshots.refreshingSince, lockCutoff()),
        ),
      ),
    )
    .returning({ id: gbpSnapshots.id });
  return claimed.length > 0;
}

/** A failed refresh keeps the old data and lets the next request try again. */
export async function releaseSnapshotRefresh(
  target: SnapshotTarget,
): Promise<void> {
  await db
    .update(gbpSnapshots)
    .set({ refreshingSince: null })
    .where(matches(target));
}

/** The profile's own rows of the given kinds (never shared ones). */
export async function listProfileSnapshots(
  profileId: string,
  kinds: GbpSnapshotKind[],
): Promise<
  Array<Pick<GbpSnapshot, "kind" | "key" | "fetchedAt" | "refreshingSince">>
> {
  return db
    .select({
      kind: gbpSnapshots.kind,
      key: gbpSnapshots.key,
      fetchedAt: gbpSnapshots.fetchedAt,
      refreshingSince: gbpSnapshots.refreshingSince,
    })
    .from(gbpSnapshots)
    .where(
      and(
        eq(gbpSnapshots.profileId, profileId),
        inArray(gbpSnapshots.kind, kinds),
      ),
    );
}

/** Whether any of the profile's rows of these kinds is being refreshed now. */
export async function hasRunningRefresh(
  profileId: string,
  kinds: GbpSnapshotKind[],
): Promise<boolean> {
  const [row] = await db
    .select({ id: gbpSnapshots.id })
    .from(gbpSnapshots)
    .where(
      and(
        eq(gbpSnapshots.profileId, profileId),
        inArray(gbpSnapshots.kind, kinds),
        gt(gbpSnapshots.refreshingSince, lockCutoff()),
      ),
    )
    .limit(1);
  return Boolean(row);
}
