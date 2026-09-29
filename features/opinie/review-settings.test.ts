import assert from "node:assert/strict";
import {
  RATING_INSTRUCTION_MAX,
  normalizeRatingInstructions,
  pickRatingInstructions,
} from "./review-settings";

// --- normalizacja ---
assert.equal(normalizeRatingInstructions(null), null);
assert.equal(normalizeRatingInstructions(undefined), null);
assert.equal(normalizeRatingInstructions("tekst"), null);
assert.equal(normalizeRatingInstructions(["a"]), null);
assert.equal(normalizeRatingInstructions({}), null);
assert.equal(normalizeRatingInstructions({ "1": "  ", "2": "" }), null);
assert.deepEqual(
  normalizeRatingInstructions({
    "1": "  Podaj e-mail  ",
    "5": "Zaproś ponownie",
  }),
  { "1": "Podaj e-mail", "5": "Zaproś ponownie" },
);
// klucze spoza 1-5 i wartości nie-tekstowe są odrzucane
assert.deepEqual(
  normalizeRatingInstructions({
    "0": "x",
    "6": "y",
    abc: "z",
    "3": 7,
    "4": "ok",
  }),
  { "4": "ok" },
);
// limit długości
const long = normalizeRatingInstructions({
  "2": "a".repeat(RATING_INSTRUCTION_MAX + 50),
});
assert.equal(long?.["2"]?.length, RATING_INSTRUCTION_MAX);

// --- wybór wytycznych dla oceny opinii ---
const map = { "1": "Dla jedynki", "5": "Dla piątki" };
assert.equal(pickRatingInstructions(map, 1), "Dla jedynki");
assert.equal(pickRatingInstructions(map, 5), "Dla piątki");
assert.equal(pickRatingInstructions(map, 3), null);
assert.equal(
  pickRatingInstructions(map, null),
  null,
  "brak oceny = brak wytycznych",
);
assert.equal(pickRatingInstructions(map, 0), null);
assert.equal(pickRatingInstructions(map, 6), null);
assert.equal(pickRatingInstructions(map, 4.5), null);
assert.equal(pickRatingInstructions(null, 5), null);
assert.equal(pickRatingInstructions({ "5": "   " }, 5), null);

console.log("review settings tests passed");
