import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { profiles, type GbpSnapshotKind, type Profile } from "@/lib/db/schema";
import { GBP_FRESHNESS_MS } from "@/lib/config/freshness";
import {
  getSnapshot,
  putSnapshot,
  releaseSnapshotRefresh,
  SHARED_SNAPSHOT_KINDS,
  type SnapshotTarget,
} from "@/lib/integrations/gbp/snapshots/store";
import {
  fetchSnapshotData,
  type SnapshotData,
} from "@/features/wizytowka/snapshots/sources";

/**
 * Background refresh of one snapshot row. The caller has already claimed the
 * row (`claimSnapshotRefresh`), so only one refresh runs at a time. No session
 * and no next/* - like runReviewSync it gets ids and loads the profile itself.
 * A failed refresh keeps the old snapshot, frees the row and only logs.
 */
export async function runGbpSnapshotRefresh(input: {
  /** Profile whose Google token is used (the row's own profile, or any profile for shared rows). */
  tokenProfileId: string;
  target: SnapshotTarget;
}): Promise<void> {
  const { tokenProfileId, target } = input;
  try {
    if (target.profileId !== null && target.profileId !== tokenProfileId) {
      throw new Error("Migawka nie należy do tego profilu");
    }
    const [profile]: Profile[] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.id, tokenProfileId))
      .limit(1);
    if (!profile?.gbpLocationId || !profile.oauthConnectionId) {
      throw new Error("Profil nie ma podłączonej wizytówki Google");
    }

    const data = await fetchSnapshotData(profile, target);
    await putSnapshot(target, data);
  } catch (error) {
    console.error(
      `GBP snapshot refresh failed (${target.kind} ${target.key}):`,
      error,
    );
    await releaseSnapshotRefresh(target).catch(() => {});
  }
}

/**
 * Snapshot data for background jobs (e.g. the listing analysis): a fresh row
 * is reused, otherwise the job fetches and saves it itself - it already runs
 * in the background, so waiting for Google is fine here.
 */
export async function readSnapshotForJob<K extends GbpSnapshotKind>(
  profile: Profile,
  kind: K,
  key: string,
): Promise<SnapshotData[K]> {
  const target: SnapshotTarget = {
    profileId: SHARED_SNAPSHOT_KINDS.has(kind) ? null : profile.id,
    kind,
    key,
  };
  const row = await getSnapshot(target);
  if (row && Date.now() - row.fetchedAt.getTime() <= GBP_FRESHNESS_MS[kind]) {
    return row.data as SnapshotData[K];
  }
  const data = (await fetchSnapshotData(profile, target)) as SnapshotData[K];
  await putSnapshot(target, data);
  return data;
}
