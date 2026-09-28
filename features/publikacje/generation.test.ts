import assert from "node:assert/strict";
import {
  matchPostByTitle,
  resolveChatIntent,
  resolvePostChat,
} from "../../lib/ai/chat-intent";
import { normalizeTopics, TOPIC_MAX } from "../../lib/ai/topic-list";
import { parseChatText, parseInline } from "./chat-format";
import {
  checkTopicSelection,
  MAX_TOPICS_TO_WRITE,
  MAX_POSTS_PER_REQUEST,
  planOnboardingGeneration,
  withRunTitles,
} from "./generation-rules";

/** Chat router: an edit must point at an offered post; counts are clamped. */
{
  const posts = [
    { id: "p1", title: "Post o oponach" },
    {
      id: "p2",
      title: "Dlaczego warto regularnie aktualizować zdjęcia w wizytówce",
    },
  ];
  assert.deepEqual(
    resolveChatIntent(
      { kind: "edit", postId: "p2", instruction: "zmień tytuł" },
      "zmień tytuł posta o oponach",
      posts,
    ),
    { kind: "edit", postId: "p2", instruction: "zmień tytuł" },
  );
  assert.equal(
    resolveChatIntent({ kind: "edit", postId: "zmyslone" }, "zmień", posts)
      .kind,
    "clarify",
    "an id the model made up never reaches the database",
  );
  assert.deepEqual(
    resolveChatIntent({ kind: "edit", postId: "p1" }, "krócej", posts),
    { kind: "edit", postId: "p1", instruction: "krócej" },
  );
  assert.deepEqual(
    resolveChatIntent(
      { kind: "create", count: 10, request: "opony" },
      "x",
      posts,
    ),
    { kind: "create", count: MAX_POSTS_PER_REQUEST, request: "opony" },
  );
  assert.deepEqual(resolveChatIntent({}, "napisz post", posts), {
    kind: "create",
    count: 1,
    request: "napisz post",
  });
  assert.equal(
    resolveChatIntent({ kind: "clarify", question: "Który post?" }, "x", posts)
      .kind,
    "clarify",
  );
}

/** Exact titles: "post test" is "Test", not "test 123"; answers to "który?" count. */
{
  const posts = [
    { id: "t123", title: "test 123" },
    { id: "t", title: "Test" },
    { id: "o", title: "Opony zimowe" },
  ];
  assert.equal(
    matchPostByTitle("zaproponuj mi zdjęcie dla posta test", [], posts)?.id,
    "t",
  );
  assert.equal(matchPostByTitle("test", [], posts)?.id, "t");
  assert.equal(matchPostByTitle("skróć test 123", [], posts)?.id, "t123");
  assert.equal(matchPostByTitle("coś innego", [], posts), null);

  // The router picked "test 123" after the customer answered "test".
  assert.deepEqual(
    resolveChatIntent(
      { kind: "edit", postId: "t123", instruction: "zaproponuj zdjęcie" },
      "test",
      posts,
      [
        { role: "user", text: "zaproponuj mi szdjecie dla psota test" },
        { role: "assistant", text: "Do którego posta?" },
      ],
    ),
    { kind: "edit", postId: "t", instruction: "zaproponuj zdjęcie" },
  );
  // A new title that equals another post's title does not move the edit.
  const keep = resolveChatIntent(
    { kind: "edit", postId: "o", instruction: "zmień tytuł na Test" },
    "zmień tytuł posta Opony zimowe na Test",
    posts,
  );
  assert.ok(keep.kind === "edit" && keep.postId === "o");
}

/** Conversation: replies change nothing; changes need an explicit request. */
{
  assert.deepEqual(
    resolveChatIntent(
      { kind: "reply", text: "Warto pisać o..." },
      "o czym pisać?",
      [],
    ),
    { kind: "reply", text: "Warto pisać o..." },
  );
  assert.deepEqual(
    resolvePostChat(
      { kind: "reply", text: "1. Kaktus na biurku" },
      "zaproponuj zdjęcie",
    ),
    { kind: "reply", text: "1. Kaktus na biurku" },
  );
  assert.deepEqual(
    resolvePostChat(
      {
        kind: "change",
        instruction: "dodaj zdjęcie: kaktus na biurku",
        parts: ["image", "coś"],
      },
      "ok, pierwsze",
    ),
    {
      kind: "change",
      instruction: "dodaj zdjęcie: kaktus na biurku",
      parts: ["image"],
    },
  );
  const unscoped = resolvePostChat(
    { kind: "change", instruction: "popraw" },
    "popraw",
  );
  assert.ok(
    unscoped.kind === "change" && unscoped.parts.length === 3,
    "unknown scope allows all parts (per-part guards still apply)",
  );
  assert.equal(
    resolvePostChat({}, "hm").kind,
    "reply",
    "unknown answer never changes the post",
  );
}

/** Topics from AI: cleaned, no duplicates, nothing already used. */
{
  assert.deepEqual(
    normalizeTopics(
      {
        topics: [
          "1. Jak dbać o opony zimą.",
          "„Przegląd klimatyzacji przed latem”",
          "jak dbać o opony zimą",
          "",
          42,
          "Kiedy zmienić opony na zimowe",
          "Serwis hamulców – na co uważać",
        ],
      },
      5,
      ["Kiedy zmienić opony na zimowe"],
    ),
    [
      "Jak dbać o opony zimą",
      "Przegląd klimatyzacji przed latem",
      "Serwis hamulców - na co uważać",
    ],
  );
  assert.equal(normalizeTopics(["a", "b", "c"], 2, []).length, 2);
  assert.deepEqual(normalizeTopics("nie lista", 5, []), []);
  assert.equal(normalizeTopics(["x".repeat(300)], 1, [])[0].length, TOPIC_MAX);
}

/** Writing posts: 1-10 distinct topics. */
{
  assert.deepEqual(checkTopicSelection(["a", "a", "b"]), {
    ok: true,
    ids: ["a", "b"],
  });
  assert.equal(checkTopicSelection([]).ok, false);
  const tooMany = Array.from(
    { length: MAX_TOPICS_TO_WRITE + 1 },
    (_, i) => `t${i}`,
  );
  assert.equal(checkTopicSelection(tooMany).ok, false);
}

/** Onboarding: one run per new group, one per ungrouped profile. */
{
  const plan = planOnboardingGeneration(
    [
      { profileId: "a", groupId: "g1" },
      { profileId: "b", groupId: "g1" },
      { profileId: "c", groupId: null },
      { profileId: "d", groupId: "g2" },
      { profileId: "e", groupId: null },
    ],
    new Set(["g2"]),
  );
  assert.deepEqual(plan, [
    { profileId: "a", groupId: "g1" },
    { profileId: "c", groupId: null },
    { profileId: "e", groupId: null },
  ]);
  assert.deepEqual(planOnboardingGeneration([], new Set()), []);
}

/** A run's own titles come first, so the next post avoids them too. */
{
  assert.deepEqual(withRunTitles(["stary"], ["pierwszy", "drugi"]), [
    "drugi",
    "pierwszy",
    "stary",
  ]);
  assert.deepEqual(withRunTitles(["stary"], []), ["stary"]);
}

/** Chat reply formatting: paragraphs, lists, bold - and inline lists split. */
{
  assert.deepEqual(parseInline("To **ważne** i **to**"), [
    { text: "To ", bold: false },
    { text: "ważne", bold: true },
    { text: " i ", bold: false },
    { text: "to", bold: true },
  ]);
  assert.deepEqual(parseInline("bez **pary"), [
    { text: "bez pary", bold: false },
  ]);

  const blocks = parseChatText(
    "Warto pisać o:\n\n1. **Trendach** w AI\n2. Case study\n\nCzy przygotować posty?",
  );
  assert.deepEqual(
    blocks.map((b) => b.kind),
    ["p", "ol", "p"],
  );
  const list = blocks[1];
  assert.ok(list.kind === "ol" && list.items.length === 2 && list.start === 1);

  // Old one-line replies: "wyróżniki: 1. A. 2. B. 3. C." become a list.
  const inline = parseChatText(
    "Tematy: 1. Nowe trendy w AI. 2. Case study SEO. 3. Wskazówki po zmianach w Google.",
  );
  assert.deepEqual(
    inline.map((b) => b.kind),
    ["p", "ol"],
  );
  assert.equal(inline[1].kind === "ol" && inline[1].items.length, 3);
  // A lone "1." or a date is not a list.
  assert.deepEqual(
    parseChatText("Od 1. października 2026 r. działamy dłużej.").map(
      (b) => b.kind,
    ),
    ["p"],
  );
  assert.deepEqual(
    parseChatText("- jeden\n- dwa").map((b) => b.kind),
    ["ul"],
  );
}

/** Reply text keeps line breaks and letters next to long dashes. */
{
  const reply = resolveChatIntent(
    { kind: "reply", text: "Usługi — sprzedaż\n\n1. Opony – serwis" },
    "o czym pisać?",
    [],
  );
  assert.deepEqual(reply, {
    kind: "reply",
    text: "Usługi - sprzedaż\n\n1. Opony - serwis",
  });
}

console.log("content generation tests passed");
