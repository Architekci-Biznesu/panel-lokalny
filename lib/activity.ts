import { and, eq, isNull, lt, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { accounts } from "@/lib/db/schema";
import { ACTIVITY_WRITE_EVERY_MS } from "@/lib/config/job-limits";

/**
 * `accounts.last_active_at` - login and opening the panel. The worker
 * refreshes Google data ahead only for recently active accounts. Written at
 * most every ACTIVITY_WRITE_EVERY_MS per account (memo per server instance
 * plus a guarded UPDATE), so a page view costs nothing most of the time.
 */

const globalStore = globalThis as typeof globalThis & {
  __accountActivity?: Map<string, number>;
};
const lastWrites = (globalStore.__accountActivity ??= new Map());

export async function markAccountActive(
  accountId: string,
  now: Date = new Date(),
): Promise<void> {
  const last = lastWrites.get(accountId);
  if (last && now.getTime() - last < ACTIVITY_WRITE_EVERY_MS) return;
  lastWrites.set(accountId, now.getTime());

  const cutoff = new Date(now.getTime() - ACTIVITY_WRITE_EVERY_MS);
  await db
    .update(accounts)
    .set({ lastActiveAt: now })
    .where(
      and(
        eq(accounts.id, accountId),
        or(isNull(accounts.lastActiveAt), lt(accounts.lastActiveAt, cutoff)),
      ),
    );
}
