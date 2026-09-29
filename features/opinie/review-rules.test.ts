import assert from "node:assert/strict";
import {
  AUTO_DRAFT_WINDOW_DAYS,
  REPLY_MAX_BYTES,
  autoReplyDecision,
  byteLength,
  changedAfterReply,
  checkReplyText,
  reconcileReply,
  ratingInFilter,
  splitReviewText,
  wantsAutoDraft,
  type AutoReplyInput,
} from "./review-rules";
import { starRatingToNumber } from "../../lib/integrations/gbp/star-rating";

const AUTO_SINCE = new Date("2026-09-01T10:00:00Z");
const BEFORE = new Date("2026-08-15T10:00:00Z");
const AFTER = new Date("2026-09-10T10:00:00Z");

// --- mapowanie starRating ---
assert.equal(starRatingToNumber("ONE"), 1);
assert.equal(starRatingToNumber("TWO"), 2);
assert.equal(starRatingToNumber("THREE"), 3);
assert.equal(starRatingToNumber("FOUR"), 4);
assert.equal(starRatingToNumber("FIVE"), 5);
assert.equal(starRatingToNumber("STAR_RATING_UNSPECIFIED"), null);
assert.equal(starRatingToNumber(undefined), null);
assert.equal(starRatingToNumber(5), null);
assert.equal(starRatingToNumber("five"), null);

// --- tryb automatyczny: tabela ocena x tryb x data x odpowiedź ---
type Row = [label: string, input: Partial<AutoReplyInput>, expected: boolean];
const table: Row[] = [
  // Reguła 1: 1-2 gwiazdki nigdy, nawet w trybie auto i po włączeniu
  ["1★, auto, nowa, bez odpowiedzi", { rating: 1 }, false],
  ["2★, auto, nowa, bez odpowiedzi", { rating: 2 }, false],
  ["1★, auto, stara", { rating: 1, firstSeenAt: BEFORE }, false],
  ["1★, accept", { rating: 1, mode: "accept", autoSince: null }, false],
  // Reguła 2: opinia sprzed włączenia nigdy
  ["5★, auto, sprzed włączenia", { rating: 5, firstSeenAt: BEFORE }, false],
  ["3★, auto, sprzed włączenia", { rating: 3, firstSeenAt: BEFORE }, false],
  [
    "5★, auto, dokładnie w chwili włączenia",
    { rating: 5, firstSeenAt: AUTO_SINCE },
    true,
  ],
  // Tryb włączony PRZED pierwszym importem: "pierwszy raz widziana" jest po
  // włączeniu, ale autor napisał ją wcześniej - nie ruszamy
  [
    "5★, first_seen po włączeniu, ale napisana przed włączeniem",
    { rating: 5, firstSeenAt: AFTER, reviewCreatedAt: BEFORE },
    false,
  ],
  [
    "5★, napisana po włączeniu",
    { rating: 5, firstSeenAt: AFTER, reviewCreatedAt: AFTER },
    true,
  ],
  [
    "5★, brak daty autora, widziana po włączeniu",
    { rating: 5, firstSeenAt: AFTER, reviewCreatedAt: null },
    true,
  ],
  // Reguła 3: już z odpowiedzią
  ["5★, auto, nowa, z odpowiedzią", { rating: 5, hasReply: true }, false],
  // Reguła 4: 3-5 nowa, bez odpowiedzi
  ["3★, auto, nowa", { rating: 3 }, true],
  ["4★, auto, nowa", { rating: 4 }, true],
  ["5★, auto, nowa", { rating: 5 }, true],
  // Tryb
  ["5★, accept, nowa", { rating: 5, mode: "accept" }, false],
  ["5★, auto ale brak daty włączenia", { rating: 5, autoSince: null }, false],
  // Brak oceny: człowiek decyduje
  ["brak oceny, auto, nowa", { rating: null }, false],
];
for (const [label, overrides, expected] of table) {
  const decision = autoReplyDecision({
    rating: 5,
    mode: "auto",
    autoSince: AUTO_SINCE,
    firstSeenAt: AFTER,
    reviewCreatedAt: AFTER,
    hasReply: false,
    ...overrides,
  });
  assert.equal(decision.publish, expected, label);
}
// Powody odmowy - reguła 1 wygrywa z pozostałymi
const lowAndOld = autoReplyDecision({
  rating: 1,
  mode: "auto",
  autoSince: AUTO_SINCE,
  firstSeenAt: BEFORE,
  reviewCreatedAt: BEFORE,
  hasReply: false,
});
assert.deepEqual(lowAndOld, { publish: false, reason: "low_rating" });

// --- rozdzielanie tłumaczenia Google ---
assert.deepEqual(splitReviewText(null), { original: null, translated: null });
assert.deepEqual(splitReviewText(""), { original: null, translated: null });
assert.deepEqual(splitReviewText("   "), { original: null, translated: null });
assert.deepEqual(splitReviewText("Świetny serwis!"), {
  original: "Świetny serwis!",
  translated: null,
});
assert.deepEqual(
  splitReviewText(
    "(Translated by Google) Great service, fast and friendly.\n\n(Original)\nSuper Service, schnell und freundlich.",
  ),
  {
    original: "Super Service, schnell und freundlich.",
    translated: "Great service, fast and friendly.",
  },
);
// Sam znacznik bez oryginału nie może zgubić tekstu
assert.deepEqual(splitReviewText("(Translated by Google) tylko tłumaczenie"), {
  original: "(Translated by Google) tylko tłumaczenie",
  translated: null,
});

// --- limit bajtów, nie znaków ---
assert.equal(byteLength("abc"), 3);
assert.equal(byteLength("ąę"), 4);
const fits = "a".repeat(REPLY_MAX_BYTES);
assert.equal(checkReplyText(fits).ok, true);
assert.equal(checkReplyText(fits + "a").ok, false);
// 2100 polskich znaków = 4200 bajtów: mieści się w limicie znaków, nie bajtów
const polish = "ą".repeat(2100);
assert.equal(polish.length < REPLY_MAX_BYTES, true);
const polishCheck = checkReplyText(polish);
assert.equal(polishCheck.ok, false);
if (!polishCheck.ok) {
  assert.match(polishCheck.error, /4200 z 4096 bajtów/);
  assert.match(polishCheck.error, /skróć o 104/);
}
assert.equal(checkReplyText("ą".repeat(2048)).ok, true);
assert.equal(checkReplyText("   ").ok, false);
const trimmed = checkReplyText("  Dziękujemy!  ");
assert.deepEqual(trimmed, { ok: true, text: "Dziękujemy!" });

// --- okno 30 dni dla szkiców bez pytania ---
const now = new Date("2026-09-29T12:00:00Z");
const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000);
const base = { replyText: null, firstSeenAt: now };
assert.equal(
  wantsAutoDraft({ ...base, reviewCreatedAt: daysAgo(1) }, now),
  true,
);
assert.equal(
  wantsAutoDraft(
    { ...base, reviewCreatedAt: daysAgo(AUTO_DRAFT_WINDOW_DAYS) },
    now,
  ),
  true,
);
assert.equal(
  wantsAutoDraft(
    { ...base, reviewCreatedAt: daysAgo(AUTO_DRAFT_WINDOW_DAYS + 1) },
    now,
  ),
  false,
);
assert.equal(
  wantsAutoDraft({ ...base, reviewCreatedAt: daysAgo(400) }, now),
  false,
);
assert.equal(
  wantsAutoDraft(
    { replyText: "Dziękujemy", firstSeenAt: now, reviewCreatedAt: daysAgo(1) },
    now,
  ),
  false,
);

// --- opinia zmieniona po odpowiedzi ---
const t = (iso: string) => new Date(iso);
assert.equal(
  changedAfterReply({
    reviewUpdatedAt: t("2026-09-20T10:00:00Z"),
    repliedAt: t("2026-09-10T10:00:00Z"),
  }),
  true,
);
assert.equal(
  changedAfterReply({
    reviewUpdatedAt: t("2026-09-10T10:00:00Z"),
    repliedAt: t("2026-09-10T10:00:00Z"),
  }),
  false,
);
// Sekundy po odpowiedzi to znacznik Google, nie zmiana autora
assert.equal(
  changedAfterReply({
    reviewUpdatedAt: t("2026-09-10T10:00:05Z"),
    repliedAt: t("2026-09-10T10:00:00Z"),
  }),
  false,
);
assert.equal(
  changedAfterReply({
    reviewUpdatedAt: t("2026-09-10T10:02:00Z"),
    repliedAt: t("2026-09-10T10:00:00Z"),
  }),
  true,
);
assert.equal(
  changedAfterReply({
    reviewUpdatedAt: t("2026-09-20T10:00:00Z"),
    repliedAt: null,
  }),
  false,
);

// --- odpowiedź po synchronizacji ---
const fallback = new Date("2026-09-29T12:00:00Z");
const replyAt = new Date("2026-09-20T09:00:00Z");
const none = { replyText: null, replySource: null, repliedAt: null };
// nowa opinia z odpowiedzią dodaną w Google
assert.deepEqual(
  reconcileReply(null, { text: "Dziękujemy!", updatedAt: replyAt }, fallback),
  {
    replyText: "Dziękujemy!",
    replySource: "external",
    repliedAt: replyAt,
    clearDraft: true,
  },
);
// nasza odpowiedź, ten sam tekst (Google zmienił białe znaki) zostaje "panel"
assert.equal(
  reconcileReply(
    {
      replyText: "Dziękujemy\nza opinię",
      replySource: "panel",
      repliedAt: replyAt,
    },
    { text: "Dziękujemy za opinię ", updatedAt: replyAt },
    fallback,
  ).replySource,
  "panel",
);
// ktoś podmienił naszą odpowiedź w Google
const replaced = reconcileReply(
  { replyText: "Nasza", replySource: "panel", repliedAt: replyAt },
  { text: "Inna, od agencji", updatedAt: fallback },
  fallback,
);
assert.equal(replaced.replySource, "external");
assert.equal(replaced.replyText, "Inna, od agencji");
assert.equal(replaced.clearDraft, false); // trwa edycja - szkic zostaje
// odpowiedź zniknęła w Google
assert.deepEqual(
  reconcileReply(
    { replyText: "Nasza", replySource: "panel", repliedAt: replyAt },
    null,
    fallback,
  ),
  { replyText: null, replySource: null, repliedAt: null, clearDraft: false },
);
// brak odpowiedzi po obu stronach
assert.deepEqual(reconcileReply(null, null, fallback), {
  ...none,
  clearDraft: false,
});
// brak daty odpowiedzi w Google: bierzemy czas synchronizacji
assert.equal(
  reconcileReply(null, { text: "Ok", updatedAt: null }, fallback).repliedAt,
  fallback,
);

// --- filtr oceny ---
assert.equal(ratingInFilter(1, "low"), true);
assert.equal(ratingInFilter(2, "low"), true);
assert.equal(ratingInFilter(3, "low"), false);
assert.equal(ratingInFilter(3, "mid"), true);
assert.equal(ratingInFilter(4, "high"), true);
assert.equal(ratingInFilter(5, "high"), true);
assert.equal(ratingInFilter(5, "mid"), false);
assert.equal(ratingInFilter(null, "all"), true);
assert.equal(ratingInFilter(null, "high"), false);

console.log("review rules tests passed");
