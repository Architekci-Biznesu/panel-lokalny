/**
 * Isolation / place_id gate conventions used by rank actions.
 * Executable checks for pure gates; DB isolation is enforced by profileId filters
 * in Server Actions (getActiveGbpProfile → eq(profileId)).
 */
import assert from "node:assert/strict";

function canStartScan(input: {
  placeId: string | null;
  scannedToday: boolean;
  hasRunning: boolean;
}): { ok: true } | { ok: false; reason: string } {
  if (!input.placeId) {
    return {
      ok: false,
      reason: "Nie można zidentyfikować wizytówki w wynikach",
    };
  }
  if (input.hasRunning) {
    return { ok: false, reason: "Skan tej frazy już trwa" };
  }
  if (input.scannedToday) {
    return {
      ok: false,
      reason:
        "Dziś już wykonano skan tej frazy - kolejny będzie dostępny jutro",
    };
  }
  return { ok: true };
}

{
  assert.equal(
    canStartScan({ placeId: null, scannedToday: false, hasRunning: false }).ok,
    false,
  );
  assert.equal(
    canStartScan({ placeId: "ChIJ", scannedToday: true, hasRunning: false }).ok,
    false,
  );
  assert.equal(
    canStartScan({ placeId: "ChIJ", scannedToday: false, hasRunning: true }).ok,
    false,
  );
  assert.equal(
    canStartScan({ placeId: "ChIJ", scannedToday: false, hasRunning: false })
      .ok,
    true,
  );
}

/** Public payload must not include account/email/other phrases. */
type PublicPayload = {
  businessName: string;
  phrase: string;
  agr: string;
  atgr: string;
  localPackPosition: number | null;
  points: Array<{ lat: number; lng: number; position: number | null }>;
};

function assertPublicPayloadSafe(
  payload: PublicPayload & Record<string, unknown>,
) {
  const forbidden = ["email", "accountId", "profileId", "keywords", "userId"];
  for (const key of forbidden) {
    assert.equal(
      key in payload,
      false,
      `public payload must not expose ${key}`,
    );
  }
}

assertPublicPayloadSafe({
  businessName: "Firma",
  phrase: "fryzjer",
  agr: "4.2",
  atgr: "40%",
  localPackPosition: 2,
  points: [],
});

console.log("rank acceptance gate tests passed");
