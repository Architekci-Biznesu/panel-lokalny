import assert from "node:assert/strict";
import type { ContentItem, ContentTarget } from "../../lib/db/schema";
import {
  ChannelPublishError,
  type ChannelPublishers,
} from "../../lib/integrations/channel";
import {
  CHANNEL_SOON_MESSAGE,
  initialTargetStatus,
  publishQueuedTargets,
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

  /** Group publishing: one failing target never stops the others. */
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
          if (t.profileId === "boom") throw new Error("socket hang up");
          return {
            externalId: `accounts/1/locations/2/localPosts/${t.profileId}`,
          };
        },
      },
    };

    const originalError = console.error;
    console.error = () => {};
    const outcomes = await publishQueuedTargets(
      item,
      [
        target("t1", "detached"),
        target("t2", "ok"),
        target("t3", "boom"),
        target("t4", "ok", { channel: "facebook" }),
        target("t5", "ok", { status: "scheduled" }),
      ],
      publishers,
      () => now,
    );
    console.error = originalError;

    assert.deepEqual(
      calls,
      ["detached", "ok", "boom"],
      "scheduled targets and channels without a publisher are not sent",
    );
    const byId = new Map(outcomes.map((o) => [o.targetId, o]));
    assert.equal(outcomes.length, 4);
    assert.deepEqual(byId.get("t1"), {
      targetId: "t1",
      status: "failed",
      error: "Profil nie ma podłączonej wizytówki Google",
    });
    assert.deepEqual(byId.get("t2"), {
      targetId: "t2",
      status: "published",
      externalId: "accounts/1/locations/2/localPosts/ok",
      publishedAt: now,
    });
    const boom = byId.get("t3");
    assert.ok(
      boom?.status === "failed" && !boom.error.includes("socket"),
      "raw errors never reach the customer",
    );
    assert.deepEqual(byId.get("t4"), {
      targetId: "t4",
      status: "failed",
      error: CHANNEL_SOON_MESSAGE,
    });
    assert.equal(byId.has("t5"), false);
  }

  console.log("content publish tests passed");
}

void main();
