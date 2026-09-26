import assert from "node:assert/strict";
import { computeAgr, computeAtgr } from "./metrics";

/** AGR: half missing (null→21) must be worse (higher) than all filled at same ranks. */
{
  const halfMissing = [1, 2, 3, null, null, null];
  const allVisible = [1, 2, 3, 1, 2, 3];
  const agrMissing = computeAgr(halfMissing);
  const agrVisible = computeAgr(allVisible);
  assert.ok(
    agrMissing > agrVisible,
    `expected AGR with nulls (${agrMissing}) > AGR without (${agrVisible})`,
  );
  assert.equal(computeAgr([null, null]), 21);
  assert.equal(computeAgr([5, 5, 5, 5]), 5);
}

/** ATGR: only top-3 count. */
{
  assert.equal(computeAtgr([1, 2, 3, 4, null]), 3 / 5);
  assert.equal(computeAtgr([null, null]), 0);
  assert.equal(computeAtgr([1, 1, 1]), 1);
}

console.log("rank metrics tests passed");
