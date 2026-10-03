import { and, eq, gte, isNotNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { accounts, profiles, type GbpSnapshotKind } from "@/lib/db/schema";
import { GBP_PREFETCH_ACTIVE_DAYS } from "@/lib/config/freshness";
import {
  claimSnapshotRefresh,
  listProfileSnapshots,
  type SnapshotTarget,
} from "@/lib/integrations/gbp/snapshots/store";
import { enqueueSnapshotRefresh } from "@/lib/queue";

const DAY_MS = 24 * 60 * 60 * 1000;

export type PrefetchKind = Extract<
  GbpSnapshotKind,
  "location" | "media" | "metrics"
>;

/** Statistics: only the rolling ranges the Pulpit and Raporty open with. */
function isPrefetchedKey(kind: PrefetchKind, key: string): boolean {
  if (kind !== "metrics") return true;
  return key.endsWith(":last30") || key.endsWith(":last30-prev-year");
}

/**
 * Refresh ahead of the visit (schedules in lib/config/freshness.ts), only for
 * profiles of accounts active in the last GBP_PREFETCH_ACTIVE_DAYS days and
 * only rows that already exist (the customer has opened that screen). It does
 * not chase the freshness limit - a visit still refreshes a stale snapshot in
 * the background. Each row is claimed like a visit claims it, so a refresh
 * already running is left alone.
 */
export async function prefetchSnapshots(
  kind: PrefetchKind,
  now: Date = new Date(),
): Promise<{ queued: number }> {
  const activeSince = new Date(
    now.getTime() - GBP_PREFETCH_ACTIVE_DAYS * DAY_MS,
  );
  const active = await db
    .select({ id: profiles.id })
    .from(profiles)
    .innerJoin(accounts, eq(accounts.id, profiles.accountId))
    .where(
      and(
        gte(accounts.lastActiveAt, activeSince),
        isNotNull(profiles.gbpLocationId),
        isNotNull(profiles.oauthConnectionId),
      ),
    );

  let queued = 0;
  for (const profile of active) {
    const rows = await listProfileSnapshots(profile.id, [kind]);
    for (const row of rows) {
      if (!isPrefetchedKey(kind, row.key)) continue;
      const target: SnapshotTarget = {
        profileId: profile.id,
        kind: row.kind,
        key: row.key,
      };
      if (!(await claimSnapshotRefresh(target))) continue;
      await enqueueSnapshotRefresh({ tokenProfileId: profile.id, target });
      queued += 1;
    }
  }
  return { queued };
}
