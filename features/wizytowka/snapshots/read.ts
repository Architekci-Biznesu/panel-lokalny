import { after } from "next/server";
import type { GbpSnapshotKind, Profile } from "@/lib/db/schema";
import { GBP_FRESHNESS_MS } from "@/lib/config/freshness";
import {
  claimSnapshotRefresh,
  getSnapshot,
  hasRunningRefresh,
  isRefreshing,
  listProfileSnapshots,
  putSnapshot,
  SHARED_SNAPSHOT_KINDS,
  type SnapshotTarget,
} from "@/lib/integrations/gbp/snapshots/store";
import { runGbpSnapshotRefresh } from "@/features/wizytowka/snapshots/refresh";
import {
  fetchSnapshotData,
  type SnapshotData,
} from "@/features/wizytowka/snapshots/sources";

/**
 * Google data for panel pages, from the snapshot in the database:
 * - fresh snapshot -> returned, nothing else happens
 * - stale snapshot -> returned at once, refreshed in the background
 * - no snapshot (first visit after connecting) -> fetched, saved, returned
 * `profile` must come from `getActiveProfile()` - rows are always looked up
 * by its id (shared dictionaries by `profile_id = null`).
 */

export type SnapshotRead<T> = {
  data: T;
  fetchedAt: Date;
  /** A background refresh of this snapshot is running. */
  refreshing: boolean;
};

function targetFor(
  profile: Profile,
  kind: GbpSnapshotKind,
  key: string,
): SnapshotTarget {
  return {
    profileId: SHARED_SNAPSHOT_KINDS.has(kind) ? null : profile.id,
    kind,
    key,
  };
}

function scheduleRefresh(profile: Profile, target: SnapshotTarget) {
  // TODO: przenieść do kolejki BullMQ (Faza 5)
  after(() => runGbpSnapshotRefresh({ tokenProfileId: profile.id, target }));
}

// First fetch of a missing snapshot: tabs opened at the same time share one
// request (per server instance - there is no row to lock yet).
const globalStore = globalThis as typeof globalThis & {
  __gbpSnapshotFirstFetch?: Map<string, Promise<unknown>>;
};
const firstFetches = (globalStore.__gbpSnapshotFirstFetch ??= new Map());

function fetchMissing(profile: Profile, target: SnapshotTarget) {
  const id = `${target.profileId ?? "shared"}|${target.kind}|${target.key}`;
  const running = firstFetches.get(id);
  if (running) return running;

  const fetching = (async () => {
    const data = await fetchSnapshotData(profile, target);
    await putSnapshot(target, data);
    return data;
  })().finally(() => firstFetches.delete(id));
  firstFetches.set(id, fetching);
  return fetching;
}

export async function readGbpSnapshot<K extends GbpSnapshotKind>(
  profile: Profile,
  kind: K,
  key: string,
): Promise<SnapshotRead<SnapshotData[K]>> {
  const target = targetFor(profile, kind, key);
  const row = await getSnapshot(target);

  if (!row) {
    const data = (await fetchMissing(profile, target)) as SnapshotData[K];
    return { data, fetchedAt: new Date(), refreshing: false };
  }

  const data = row.data as SnapshotData[K];
  const stale = Date.now() - row.fetchedAt.getTime() > GBP_FRESHNESS_MS[kind];
  if (!stale) {
    return { data, fetchedAt: row.fetchedAt, refreshing: isRefreshing(row) };
  }

  if (await claimSnapshotRefresh(target)) scheduleRefresh(profile, target);
  return { data, fetchedAt: row.fetchedAt, refreshing: true };
}

/** Snapshot kinds a screen shows - their age is what the customer sees. */
export const WIZYTOWKA_SNAPSHOT_KINDS: GbpSnapshotKind[] = [
  "location",
  "media",
];
export const PULPIT_SNAPSHOT_KINDS: GbpSnapshotKind[] = [
  "location",
  "media",
  "metrics",
];

export type GbpDataStatus = {
  /** Oldest of the screen's snapshots (null before the first fetch). */
  fetchedAt: Date | null;
  refreshing: boolean;
};

export async function getGbpDataStatus(
  profile: Profile,
  kinds: GbpSnapshotKind[],
): Promise<GbpDataStatus> {
  const rows = await listProfileSnapshots(profile.id, kinds);
  let oldest: Date | null = null;
  for (const row of rows) {
    if (!oldest || row.fetchedAt < oldest) oldest = row.fetchedAt;
  }
  return {
    fetchedAt: oldest,
    refreshing: rows.some((row) => isRefreshing(row)),
  };
}

/**
 * "Odśwież z Google": refreshes the profile's snapshots of these kinds now,
 * whatever their age. Rows already being refreshed are left alone.
 */
export async function requestGbpDataRefresh(
  profile: Profile,
  kinds: GbpSnapshotKind[],
): Promise<void> {
  const rows = await listProfileSnapshots(profile.id, kinds);
  for (const row of rows) {
    const target: SnapshotTarget = {
      profileId: profile.id,
      kind: row.kind,
      key: row.key,
    };
    if (await claimSnapshotRefresh(target)) scheduleRefresh(profile, target);
  }
}

export async function isGbpDataRefreshing(
  profile: Profile,
  kinds: GbpSnapshotKind[],
): Promise<boolean> {
  return hasRunningRefresh(profile.id, kinds);
}

/** Saves data Google returned after a write, so the change shows at once. */
export async function saveGbpSnapshot<K extends GbpSnapshotKind>(
  profile: Profile,
  kind: K,
  key: string,
  data: SnapshotData[K],
): Promise<void> {
  await putSnapshot(targetFor(profile, kind, key), data);
}

/** Current snapshot data without fetching or refreshing (null when missing). */
export async function peekGbpSnapshot<K extends GbpSnapshotKind>(
  profile: Profile,
  kind: K,
  key: string,
): Promise<SnapshotData[K] | null> {
  const row = await getSnapshot(targetFor(profile, kind, key));
  return row ? (row.data as SnapshotData[K]) : null;
}
