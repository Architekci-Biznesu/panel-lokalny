import assert from "node:assert/strict";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { TEST_EMAIL_DOMAIN, testDatabaseUrl } from "../../opinie/test-support";

/**
 * Google snapshots against a real test database. Nothing here reaches Google:
 * rows are written directly and the refresh that runs fails on purpose
 * (profile without a Google connection). Needs TEST_DATABASE_URL - the same
 * rules as the review tests (separate database, test accounts only).
 */

async function main() {
  const { config } = await import("dotenv");
  config({ path: ".env.local", quiet: true });
  const url = testDatabaseUrl();
  if (!url) {
    console.log(
      "snapshot database tests skipped (set TEST_DATABASE_URL to a test database)",
    );
    return;
  }

  const admin = postgres(url, { prepare: false, onnotice: () => {} });
  const [accountsTable] =
    await admin`select to_regclass('public.accounts') as name`;
  if (accountsTable.name) {
    const [real] = await admin`
      select count(*)::int as count from public.accounts
      where email not like ${"%" + TEST_EMAIL_DOMAIN}`;
    if (real.count > 0) {
      await admin.end();
      throw new Error(
        `Baza testowa ma ${real.count} prawdziwych kont - to nie jest baza do testów, nic nie usunięto`,
      );
    }
  }
  await admin`drop schema if exists public cascade`;
  await admin`drop schema if exists drizzle cascade`;
  await admin`create schema public`;
  await migrate(drizzle(admin), { migrationsFolder: "drizzle" });
  await admin.end();
  process.env.DATABASE_URL = url;

  const { db } = await import("../../../lib/db");
  const { accounts, profiles, gbpSnapshots } =
    await import("../../../lib/db/schema");
  const { eq, sql } = await import("drizzle-orm");
  const store = await import("../../../lib/integrations/gbp/snapshots/store");
  const { peekGbpSnapshot, getGbpDataStatus } = await import("./read");
  const { runGbpSnapshotRefresh } = await import("./refresh");

  async function makeProfile(email: string) {
    const [account] = await db.insert(accounts).values({ email }).returning();
    const [profile] = await db
      .insert(profiles)
      .values({
        accountId: account.id,
        name: `Firma ${email}`,
        gbpLocationId: "locations/1",
      })
      .returning();
    return profile;
  }

  const a = await makeProfile(`a${TEST_EMAIL_DOMAIN}`);
  const b = await makeProfile(`b${TEST_EMAIL_DOMAIN}`);
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000);

  // 1. Isolation: a profile's snapshot is not reachable from another account.
  {
    const target = {
      profileId: a.id,
      kind: "location" as const,
      key: "locations/1",
    };
    await store.putSnapshot(target, {
      raw: { title: "Firma A" },
      attributes: [],
      categoryDetails: [],
    });

    const own = await peekGbpSnapshot(a, "location", "locations/1");
    assert.equal(own?.raw.title, "Firma A");
    // Same location name, other account - reads are always by its own id.
    assert.equal(await peekGbpSnapshot(b, "location", "locations/1"), null);
    assert.equal(
      (await store.listProfileSnapshots(b.id, ["location"])).length,
      0,
    );
    const status = await getGbpDataStatus(b, ["location", "media"]);
    assert.equal(status.fetchedAt, null);
  }

  // 2. Shared dictionaries: one row for everybody (profile_id null is unique too).
  {
    const shared = {
      profileId: null,
      kind: "categories" as const,
      key: "PL:pl",
    };
    await store.putSnapshot(shared, [{ name: "c1", displayName: "C1" }]);
    await store.putSnapshot(shared, [{ name: "c2", displayName: "C2" }]);
    const rows = await db
      .select()
      .from(gbpSnapshots)
      .where(eq(gbpSnapshots.kind, "categories"));
    assert.equal(rows.length, 1);
    assert.equal(rows[0].profileId, null);
    const fromA = await peekGbpSnapshot(a, "categories", "PL:pl");
    const fromB = await peekGbpSnapshot(b, "categories", "PL:pl");
    assert.deepEqual(fromA, fromB);
    // Shared rows never count as a profile's own data.
    assert.equal(
      (await store.listProfileSnapshots(a.id, ["categories"])).length,
      0,
    );
  }

  // 3. Ten parallel refreshes of a stale snapshot: only one wins.
  {
    const target = {
      profileId: a.id,
      kind: "media" as const,
      key: "locations/1",
    };
    await store.putSnapshot(target, { owner: [], customers: [] }, hourAgo);
    const claims = await Promise.all(
      Array.from({ length: 10 }, () => store.claimSnapshotRefresh(target)),
    );
    assert.equal(claims.filter(Boolean).length, 1, "jedno odświeżanie naraz");
    assert.equal(
      (await getGbpDataStatus(a, ["media"])).refreshing,
      true,
      "status pokazuje trwające odświeżanie",
    );

    // A refresh that looks dead (older than the lock) may be taken over.
    await db
      .update(gbpSnapshots)
      .set({ refreshingSince: sql`now() - interval '3 minutes'` })
      .where(eq(gbpSnapshots.kind, "media"));
    assert.equal(await store.claimSnapshotRefresh(target), true);
  }

  // 4. A failed refresh keeps the old data and frees the row.
  {
    const target = {
      profileId: a.id,
      kind: "location" as const,
      key: "locations/1",
    };
    await db
      .update(gbpSnapshots)
      .set({ fetchedAt: hourAgo })
      .where(eq(gbpSnapshots.kind, "location"));
    assert.equal(await store.claimSnapshotRefresh(target), true);
    const errors = console.error;
    console.error = () => {};
    try {
      // Profile has no Google connection - the refresh fails before any request.
      await runGbpSnapshotRefresh({ tokenProfileId: a.id, target });
    } finally {
      console.error = errors;
    }
    const row = await store.getSnapshot(target);
    assert.equal(
      (row?.data as { raw: { title: string } }).raw.title,
      "Firma A",
    );
    assert.equal(row?.fetchedAt.getTime(), hourAgo.getTime());
    assert.equal(row?.refreshingSince, null);
  }

  // 5. The refresh never uses one profile's token for another profile's row.
  {
    const target = {
      profileId: a.id,
      kind: "location" as const,
      key: "locations/1",
    };
    assert.equal(await store.claimSnapshotRefresh(target), true);
    const errors: unknown[] = [];
    const original = console.error;
    console.error = (...args: unknown[]) => errors.push(args);
    try {
      await runGbpSnapshotRefresh({ tokenProfileId: b.id, target });
    } finally {
      console.error = original;
    }
    assert.match(String(errors[0]), /nie należy do tego profilu/);
    const row = await store.getSnapshot(target);
    assert.equal(
      (row?.data as { raw: { title: string } }).raw.title,
      "Firma A",
    );
  }

  await db.$client.end();
  console.log("snapshots-db.test: OK");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
