import assert from "node:assert/strict";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import type { ContentItem, ContentTarget } from "../../lib/db/schema";
import {
  ChannelPublishError,
  PUBLISH_UNKNOWN_OUTCOME_MESSAGE,
  type ChannelPublishers,
  type PublishRetry,
} from "../../lib/integrations/channel";
import { TEST_EMAIL_DOMAIN, testDatabaseUrl } from "../opinie/test-support";

/**
 * Publishing posts against a real (local) database with a FAKE channel -
 * nothing here can reach Google. The claim must let exactly one job publish a
 * target; transient errors are retried by BullMQ (3 attempts), everything
 * else fails at once. With REDIS_URL set, the retries run through a real
 * BullMQ queue (own prefix, removed at the end).
 */

async function main() {
  const { config } = await import("dotenv");
  config({ path: ".env.local", quiet: true });
  const url = testDatabaseUrl();
  if (!url) {
    console.log(
      "publish job database tests skipped (set TEST_DATABASE_URL to a LOCAL Postgres)",
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

  const { db } = await import("../../lib/db");
  const { accounts, profiles, contentItems, contentTargets } =
    await import("../../lib/db/schema");
  const { eq } = await import("drizzle-orm");
  const { claimPublishTarget, publishJobDeps, publishTarget } =
    await import("./publish-job");
  const { failStaleRuns } = await import("../maintenance/stale-runs");
  const { PUBLISH_TARGET_STALE_MS } =
    await import("../../lib/config/job-limits");

  const now = new Date();
  let clock = now;
  const [account] = await db
    .insert(accounts)
    .values({ email: `publish${TEST_EMAIL_DOMAIN}` })
    .returning();
  const [profile] = await db
    .insert(profiles)
    .values({ accountId: account.id, name: "Firma testowa" })
    .returning();
  async function newTarget(
    values: Partial<typeof contentTargets.$inferInsert> = {},
  ): Promise<ContentTarget> {
    // One target per (item, profile, channel): a fresh item for every case.
    const [own] = await db
      .insert(contentItems)
      .values({
        profileId: profile.id,
        type: "post",
        origin: "manual",
        status: "accepted",
        topic: "Test",
        title: "Post testowy",
        body: "Treść posta",
      } as typeof contentItems.$inferInsert)
      .returning();
    const [target] = await db
      .insert(contentTargets)
      .values({
        contentItemId: own.id,
        profileId: profile.id,
        channel: "gbp",
        status: "queued",
        ...values,
      })
      .returning();
    return target;
  }

  async function reload(id: string) {
    const [row] = await db
      .select()
      .from(contentTargets)
      .where(eq(contentTargets.id, id));
    return row;
  }

  /** Fake Google: answers from the script, counts the requests. */
  function fakeChannel(script: Array<PublishRetry | "ok">) {
    const calls: string[] = [];
    const publishers: ChannelPublishers = {
      gbp: {
        async publish(_item: ContentItem, target: ContentTarget) {
          calls.push(target.id);
          const answer = script[Math.min(calls.length, script.length) - 1];
          if (answer === "ok") {
            return { externalId: `localPosts/${calls.length}` };
          }
          throw new ChannelPublishError(
            answer === "retry"
              ? "Google odpowiedział 503"
              : answer === "final"
                ? "Google odrzucił post: 400"
                : PUBLISH_UNKNOWN_OUTCOME_MESSAGE,
            answer,
          );
        },
      },
    };
    return {
      calls,
      deps: publishJobDeps({ db, publishers, now: () => clock }),
    };
  }

  // 1. Two (here: ten) parallel claims of the same target - only one wins.
  {
    const target = await newTarget();
    const claims = await Promise.all(
      Array.from({ length: 10 }, () =>
        claimPublishTarget(target.id, { db, now: () => clock }),
      ),
    );
    assert.equal(claims.filter(Boolean).length, 1, "exactly one claim wins");
    assert.equal((await reload(target.id)).status, "publishing");
  }

  // 2. Parallel jobs of the same target: one request to Google, one post.
  {
    const target = await newTarget();
    const fake = fakeChannel(["ok"]);
    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        publishTarget(target.id, { number: 1, max: 3 }, fake.deps),
      ),
    );
    assert.equal(fake.calls.length, 1, "Google asked once");
    assert.equal(results.filter((r) => r.kind === "published").length, 1);
    assert.equal(results.filter((r) => r.kind === "skipped").length, 4);
    const row = await reload(target.id);
    assert.equal(row.status, "published");
    assert.equal(row.externalId, "localPosts/1");
  }

  // 3. Transient 5xx: back to queued until the last attempt, then failed.
  {
    const target = await newTarget();
    const fake = fakeChannel(["retry"]);
    const first = await publishTarget(
      target.id,
      { number: 1, max: 3 },
      fake.deps,
    );
    assert.equal(first.kind, "retry");
    assert.equal((await reload(target.id)).status, "queued");
    await publishTarget(target.id, { number: 2, max: 3 }, fake.deps);
    const last = await publishTarget(
      target.id,
      { number: 3, max: 3 },
      fake.deps,
    );
    assert.deepEqual(last, {
      kind: "failed",
      error: "Google odpowiedział 503",
    });
    const row = await reload(target.id);
    assert.equal(row.status, "failed");
    assert.equal(row.error, "Google odpowiedział 503");
    assert.equal(fake.calls.length, 3);
  }

  // 4. Final error (other 4xx, expired authorization) - failed at once.
  {
    const target = await newTarget();
    const fake = fakeChannel(["final"]);
    const result = await publishTarget(
      target.id,
      { number: 1, max: 3 },
      fake.deps,
    );
    assert.equal(result.kind, "failed");
    assert.equal((await reload(target.id)).status, "failed");
    assert.equal(fake.calls.length, 1);
  }

  // 5. Unknown result (timeout after sending) - failed with the message, no retry.
  {
    const target = await newTarget();
    const fake = fakeChannel(["unknown"]);
    const result = await publishTarget(
      target.id,
      { number: 1, max: 3 },
      fake.deps,
    );
    assert.deepEqual(result, {
      kind: "failed",
      error: PUBLISH_UNKNOWN_OUTCOME_MESSAGE,
    });
    assert.equal(fake.calls.length, 1);
  }

  // 6. Scheduled: not before its time (a later date set after the job was added).
  {
    const future = new Date(now.getTime() + 60 * 60_000);
    const target = await newTarget({
      status: "scheduled",
      scheduledAt: future,
    });
    const fake = fakeChannel(["ok"]);
    assert.equal(
      (await publishTarget(target.id, { number: 1, max: 3 }, fake.deps)).kind,
      "skipped",
    );
    assert.equal(fake.calls.length, 0);
    clock = new Date(future.getTime() + 1000);
    assert.equal(
      (await publishTarget(target.id, { number: 1, max: 3 }, fake.deps)).kind,
      "published",
    );
    clock = now;
  }

  // 7. Worker killed during the request: the target stays `publishing`. The
  // job comes back (stalled) and finds nothing to claim - no second post.
  // After the limit the sweep marks it failed with the "unknown" message.
  {
    const target = await newTarget();
    await claimPublishTarget(target.id, { db, now: () => clock });
    const fake = fakeChannel(["ok"]);
    const again = await publishTarget(
      target.id,
      { number: 1, max: 3 },
      fake.deps,
    );
    assert.equal(again.kind, "skipped");
    assert.equal(fake.calls.length, 0, "no second request to Google");

    await failStaleRuns(
      new Date(now.getTime() + PUBLISH_TARGET_STALE_MS - 1000),
    );
    assert.equal((await reload(target.id)).status, "publishing");
    await failStaleRuns(
      new Date(now.getTime() + PUBLISH_TARGET_STALE_MS + 1000),
    );
    const row = await reload(target.id);
    assert.equal(row.status, "failed");
    assert.equal(row.error, PUBLISH_UNKNOWN_OUTCOME_MESSAGE);
  }

  // 8. Through real BullMQ: 5xx = 3 attempts then failed; unknown = 1 attempt.
  if (process.env.REDIS_URL) {
    const { Queue, Worker, QueueEvents } = await import("bullmq");
    const { workerConnection } = await import("../../lib/queue/connection");
    const { publishProcessor } = await import("../../worker/processors");
    const prefix = `test-${Date.now()}`;
    const name = "publish";
    const queue = new Queue(name, { connection: workerConnection(), prefix });
    const events = new QueueEvents(name, {
      connection: workerConnection(),
      prefix,
    });
    await events.waitUntilReady();

    async function runThroughQueue(script: Array<PublishRetry | "ok">) {
      const target = await newTarget();
      const fake = fakeChannel(script);
      const worker = new Worker(name, publishProcessor(fake.deps), {
        connection: workerConnection(),
        prefix,
      });
      const job = await queue.add(
        "publish-target",
        { targetId: target.id },
        { attempts: 3, backoff: { type: "exponential", delay: 20 } },
      );
      await job.waitUntilFinished(events).catch(() => {});
      await worker.close();
      const finished = await queue.getJob(job.id!);
      return { target: await reload(target.id), fake, job: finished! };
    }

    const busy = await runThroughQueue(["retry"]);
    assert.equal(busy.fake.calls.length, 3, "5xx: three attempts");
    assert.equal(busy.job.attemptsMade, 3);
    assert.equal(busy.target.status, "failed");
    assert.equal(busy.target.error, "Google odpowiedział 503");

    const flaky = await runThroughQueue(["retry", "ok"]);
    assert.equal(flaky.fake.calls.length, 2, "5xx then OK: one post");
    assert.equal(flaky.target.status, "published");

    const unknown = await runThroughQueue(["unknown"]);
    assert.equal(unknown.fake.calls.length, 1, "unknown result: no retry");
    assert.equal(unknown.target.status, "failed");

    const final = await runThroughQueue(["final"]);
    assert.equal(final.fake.calls.length, 1, "4xx / authorization: no retry");

    await queue.obliterate({ force: true });
    await queue.close();
    await events.close();
  } else {
    console.log("BullMQ part skipped (REDIS_URL not set)");
  }

  console.log("publish job database tests passed");
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
