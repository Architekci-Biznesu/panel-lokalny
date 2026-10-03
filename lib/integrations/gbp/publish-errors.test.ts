import assert from "node:assert/strict";
import {
  GBP_V4_NOT_FOUND_MESSAGE,
  GbpHttpError,
  GbpNotConnectedError,
  GbpUnknownOutcomeError,
} from "./errors";
import { classifyGbpPublishError } from "./publish-errors";

/**
 * Which errors of publishing a post may be retried. Google has no idempotency
 * key for posts: only answers proving nothing was created and that may change
 * (5xx, 429, 408) are retried; no answer after sending is "unknown".
 */

const http = (status: number) =>
  new GbpHttpError(
    "GBP localPosts.create",
    status,
    `{"error":{"code":${status},"status":"X"}}`,
  );

// Transient - retried.
for (const status of [500, 502, 503, 504, 429, 408]) {
  assert.equal(classifyGbpPublishError(http(status)), "retry", `${status}`);
}

// Other 4xx - the same request gives the same answer: failed at once.
for (const status of [400, 403, 404, 409, 413, 422]) {
  assert.equal(classifyGbpPublishError(http(status)), "final", `${status}`);
}

// Expired authorization - failed at once, another try uses the same token.
assert.equal(
  classifyGbpPublishError(
    new GbpHttpError(
      "GBP localPosts.create",
      401,
      '{"error":{"code":401,"status":"UNAUTHENTICATED"}}',
    ),
  ),
  "final",
);
assert.equal(
  classifyGbpPublishError(new Error('token refresh failed: "UNAUTHENTICATED"')),
  "final",
);
assert.equal(classifyGbpPublishError(new GbpNotConnectedError()), "final");
assert.equal(
  classifyGbpPublishError(
    new Error(`GBP v4 location: ${GBP_V4_NOT_FOUND_MESSAGE}`),
  ),
  "final",
);

// Sent without an answer (timeout, broken connection, 2xx without a name):
// the post may exist - never retried automatically.
assert.equal(
  classifyGbpPublishError(
    new GbpUnknownOutcomeError("GBP localPosts.create", new Error("timeout")),
  ),
  "unknown",
);

// Helper calls before the post (other GBP endpoints with a status in the message).
assert.equal(
  classifyGbpPublishError(new Error("GBP accounts.list failed (503): busy")),
  "retry",
);
assert.equal(
  classifyGbpPublishError(new Error("GBP accounts.list failed (400): bad")),
  "final",
);

// A broken connection before the post was sent (token, v4 name) created nothing.
assert.equal(classifyGbpPublishError(new TypeError("fetch failed")), "retry");

console.log("publish error classification tests passed");
