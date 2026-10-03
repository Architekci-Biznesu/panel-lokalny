import assert from "node:assert/strict";
import type { ContentItem, ContentTarget } from "../../lib/db/schema";
import {
  ChannelPublishError,
  PUBLISH_UNKNOWN_OUTCOME_MESSAGE,
  type ChannelPublishers,
} from "../../lib/integrations/channel";
import {
  CHANNEL_SOON_MESSAGE,
  initialTargetStatus,
  publishOneTarget,
} from "./publish-core";

const now = new Date("2026-09-28T10:00:00Z");

const item = {
  id: "item-1",
  body: "Treść posta",
  imageUrl: null,
} as ContentItem;

function target(
  id: string,
  profileId: string,
  overrides: Partial<ContentTarget> = {},
): ContentTarget {
  return {
    id,
    contentItemId: item.id,
    profileId,
    channel: "gbp",
    status: "queued",
    scheduledAt: null,
    publishedAt: null,
    externalId: null,
    error: null,
    claimedAt: null,
    ...overrides,
  };
}

async function main() {
  /** Future date waits for the scheduler; now / none publishes right away. */
  {
    assert.equal(initialTargetStatus(null, now), "queued");
    assert.equal(
      initialTargetStatus(new Date(now.getTime() + 30_000), now),
      "queued",
    );
    assert.equal(
      initialTargetStatus(new Date(now.getTime() + 3_600_000), now),
      "scheduled",
    );
  }

  /** One target per job: outcome and whether the worker may retry. */
  {
    const calls: string[] = [];
    const publishers: ChannelPublishers = {
      gbp: {
        async publish(_item, t) {
          calls.push(t.profileId);
          if (t.profileId === "detached") {
            throw new ChannelPublishError(
              "Profil nie ma podłączonej wizytówki Google",
            );
          }
          if (t.profileId === "busy") {
            throw new ChannelPublishError(
              "Google chwilowo nie odpowiada",
              "retry",
            );
          }
          if (t.profileId === "boom") throw new Error("socket hang up");
          return {
            externalId: `accounts/1/locations/2/localPosts/${t.profileId}`,
          };
        },
      },
    };

    const originalError = console.error;
    console.error = () => {};
    const publish = (t: ContentTarget) =>
      publishOneTarget(item, t, publishers, () => now);
    const detached = await publish(target("t1", "detached"));
    const ok = await publish(target("t2", "ok"));
    const boom = await publish(target("t3", "boom"));
    const facebook = await publish(target("t4", "ok", { channel: "facebook" }));
    const busy = await publish(target("t5", "busy"));
    console.error = originalError;

    assert.deepEqual(
      calls,
      ["detached", "ok", "boom", "busy"],
      "channels without a publisher are not sent",
    );
    assert.deepEqual(detached, {
      targetId: "t1",
      status: "failed",
      error: "Profil nie ma podłączonej wizytówki Google",
      retry: "final",
    });
    assert.deepEqual(ok, {
      targetId: "t2",
      status: "published",
      externalId: "accounts/1/locations/2/localPosts/ok",
      publishedAt: now,
    });
    assert.ok(
      boom.status === "failed" && !boom.error.includes("socket"),
      "raw errors never reach the customer",
    );
    assert.deepEqual(
      boom,
      {
        targetId: "t3",
        status: "failed",
        error: PUBLISH_UNKNOWN_OUTCOME_MESSAGE,
        retry: "unknown",
      },
      "a raw error inside the adapter may have created the post - never retried",
    );
    assert.deepEqual(facebook, {
      targetId: "t4",
      status: "failed",
      error: CHANNEL_SOON_MESSAGE,
      retry: "final",
    });
    assert.equal(busy.status === "failed" && busy.retry, "retry");
  }

  console.log("content publish tests passed");
}

void main();
