import assert from "node:assert/strict";
import {
  matchPostByTitle,
  resolveChatIntent,
  resolvePostChat,
} from "../../lib/ai/chat-intent";
import {
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

console.log("content generation tests passed");
