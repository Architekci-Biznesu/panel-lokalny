import assert from "node:assert/strict";
import type { ContentContext } from "../../lib/ai/types";
import {
  contentContextBlock,
  contentUserPrompt,
  topicUserPrompt,
} from "../../lib/ai/content-prompts";
import { mergeAvoid } from "../../lib/brief-avoid";
import {
  instructionAsksForImage,
  instructionAsksForTitle,
  mergeGeneratedContent,
} from "../../lib/ai/content-revision";
import { gbpPublishErrorMessage } from "../../lib/integrations/gbp/publish-errors";
import { contentDisplayStatus, matchesStatusFilter } from "./content-status";
import { extractGbpSnapshot } from "./gbp-snapshot";
import { groupSiblings, resolveGroupTargets } from "./group-targets";

const context: ContentContext = {
  businessName: "Auto Serwis Kowalski",
  brief: {
    services: "wymiana opon, klimatyzacja",
    tone: "rzeczowy",
    targetAudience: "kierowcy z Mokotowa",
    differentiators: "od 2010",
  },
  serviceArea: "Warszawa Mokotów",
  avoid: "nie pisz o promocjach\nbez cen",
  outOfScope: "blacharstwo",
  categories: ["Warsztat samochodowy"],
  services: ["Wymiana opon"],
  recentTitles: ["Kiedy zmienić opony na zimowe", "Serwis klimatyzacji wiosną"],
};

/** Rejection reasons land in `avoid` once, as separate lines. */
{
  assert.equal(
    mergeAvoid(null, "nie pisz o promocjach"),
    "nie pisz o promocjach",
  );
  assert.equal(mergeAvoid("a\nb", "c"), "a\nb\nc");
  assert.equal(
    mergeAvoid("Nie pisz o promocjach", "nie pisz o promocjach"),
    "Nie pisz o promocjach",
  );
  assert.equal(mergeAvoid("a", "  "), "a");
}

/** avoid / outOfScope are hard bans and recent titles are listed in every prompt. */
{
  const block = contentContextBlock(context);
  assert.match(
    block,
    /ZAKAZY[^\n]*\n- nie pisz o promocjach\n- bez cen\n- blacharstwo/,
  );
  assert.match(block, /NIE powtarzaj[^\n]*\n- Kiedy zmienić opony na zimowe/);
  assert.match(block, /Obszar działania: Warszawa Mokotów/);

  const topic = topicUserPrompt({ context, request: "przegląd przed zimą" });
  assert.match(topic, /ZAKAZY/);
  assert.match(
    topic,
    /Prośba klienta - o czym ma być publikacja: przegląd przed zimą/,
  );

  const revision = contentUserPrompt({
    context,
    topic: "Przegląd przed zimą",
    revision: {
      previousTitle: "Stary tytuł",
      previousBody: "Stara treść",
      instruction: "krócej",
    },
  });
  assert.match(revision, /Obecna treść posta:\nStara treść/);
  assert.match(revision, /Instrukcja klienta - co zmienić: krócej/);
  assert.doesNotMatch(
    contentUserPrompt({ context, topic: "X" }),
    /Instrukcja klienta/,
  );

  // Earlier requests about the post reach the prompt ("a teraz jeszcze krócej").
  const withHistory = contentUserPrompt({
    context,
    topic: "X",
    revision: {
      previousTitle: "T",
      previousBody: "B",
      instruction: "a teraz jeszcze krócej",
      history: ["skróć do 3 zdań", "zaproponuj zdjęcie"],
    },
  });
  assert.match(
    withHistory,
    /Wcześniejsze prośby klienta[^\n]*\n- skróć do 3 zdań\n- zaproponuj zdjęcie/,
  );

  const empty = contentContextBlock({
    ...context,
    avoid: null,
    outOfScope: null,
    recentTitles: [],
  });
  assert.match(empty, /ZAKAZY: brak\./);
  assert.match(empty, /Ostatnie publikacje: brak\./);
}

/** Group targets: siblings only; a profile from another account/group is rejected. */
{
  const options = [
    { id: "a", name: "Filia A", groupId: "g1" },
    { id: "b", name: "Filia B", groupId: "g1" },
    { id: "c", name: "Inna", groupId: "g2" },
    { id: "d", name: "Bez grupy", groupId: null },
  ];
  assert.deepEqual(
    groupSiblings("a", options).map((o) => o.id),
    ["b"],
  );
  assert.deepEqual(groupSiblings("d", options), []);
  assert.deepEqual(resolveGroupTargets("a", ["b", "b", "a"], options), ["b"]);
  assert.deepEqual(resolveGroupTargets("a", [], options), []);
  assert.throws(
    () => resolveGroupTargets("a", ["c"], options),
    /grupy publikacji/,
  );
  assert.throws(
    () => resolveGroupTargets("a", ["foreign-profile-id"], options),
    /grupy publikacji/,
  );
}

/** One status per publication, from item + targets. */
{
  assert.equal(contentDisplayStatus("pending", []), "pending");
  assert.equal(contentDisplayStatus("rejected", []), "rejected");
  assert.equal(
    contentDisplayStatus("accepted", ["queued", "published"]),
    "publishing",
  );
  assert.equal(
    contentDisplayStatus("accepted", ["published", "failed"]),
    "partial",
  );
  assert.equal(contentDisplayStatus("accepted", ["failed"]), "failed");
  assert.equal(contentDisplayStatus("accepted", ["scheduled"]), "scheduled");
  assert.equal(
    contentDisplayStatus("accepted", ["published", "published"]),
    "published",
  );
  assert.ok(matchesStatusFilter("partial", "failed"));
  assert.ok(matchesStatusFilter("partial", "published"));
  assert.ok(!matchesStatusFilter("rejected", "published"));
}

/** Google errors become readable messages; expired auth asks to reconnect. */
{
  assert.match(
    gbpPublishErrorMessage(
      new Error(
        'GBP localPosts.create failed: {"error": {"code": 401, "status": "UNAUTHENTICATED"}}',
      ),
    ),
    /połącz ponownie wizytówkę/,
  );
  assert.equal(
    gbpPublishErrorMessage(
      new Error(
        'GBP localPosts.create failed: {"error": {"code": 400, "message": "Summary too long", "status": "INVALID_ARGUMENT"}}',
      ),
    ),
    "Google odrzucił post: Summary too long",
  );
  assert.equal(
    gbpPublishErrorMessage(new Error("fetch failed")),
    "Nie udało się opublikować posta w Google",
  );
}

/** Google snapshot -> category and service names for the prompt. */
{
  const snapshot = extractGbpSnapshot({
    categories: {
      primaryCategory: { displayName: "Warsztat samochodowy" },
      additionalCategories: [
        { displayName: "Serwis opon" },
        { displayName: "Serwis opon" },
      ],
    },
    serviceItems: [
      { freeFormServiceItem: { label: { displayName: "Wymiana opon" } } },
      {
        structuredServiceItem: {
          serviceTypeId: "job_type_id:air_conditioning_repair",
        },
      },
    ],
  });
  assert.deepEqual(snapshot.categories, [
    "Warsztat samochodowy",
    "Serwis opon",
  ]);
  assert.deepEqual(snapshot.services, [
    "Wymiana opon",
    "air conditioning repair",
  ]);
  assert.deepEqual(extractGbpSnapshot(null), { categories: [], services: [] });
}

/** Chat edit: only the parts the customer asked for change, even if AI rewrote more. */
{
  const revision = {
    previousTitle: "Stary tytuł",
    previousBody: "Stara treść",
    instruction: "zmień tytuł",
  };
  const titleOnly = mergeGeneratedContent(
    { changes: ["title"], title: "Nowy tytuł.", body: "Przepisana treść" },
    revision,
    1500,
  );
  assert.deepEqual(titleOnly, {
    body: "Stara treść",
    title: "Nowy tytuł",
    newImagePrompt: null,
  });
  const imageOnly = mergeGeneratedContent(
    { changes: ["image"], newImagePrompt: "office photo", title: "X" },
    { ...revision, instruction: "daj inne zdjęcie" },
    1500,
  );
  assert.deepEqual(imageOnly, {
    body: "Stara treść",
    title: null,
    newImagePrompt: "office photo",
  });
  assert.equal(
    mergeGeneratedContent(
      { changes: ["title"], title: "Stary tytuł" },
      revision,
      1500,
    ).title,
    null,
    "same title is not a change",
  );
  assert.throws(() => mergeGeneratedContent({ body: "" }, null, 1500));

  // A post about photos: "zmień tytuł" never adds an image, even if AI marks it.
  const photoPost = {
    previousTitle: "Dlaczego warto aktualizować zdjęcia w wizytówce",
    previousBody: "Treść",
    instruction:
      "zaktualizuj tytuł na test 123: Dlaczego warto aktualizować zdjęcia w wizytówce",
  };
  assert.equal(
    mergeGeneratedContent(
      {
        changes: ["title", "image"],
        title: "test 123",
        newImagePrompt: "photo",
      },
      photoPost,
      1500,
    ).newImagePrompt,
    null,
  );
  assert.ok(instructionAsksForImage("podmień grafikę na biuro", "Tytuł"));
  assert.ok(!instructionAsksForImage("zmień tytuł", "Tytuł o zdjęciach"));

  // "opis" is the post text - the title stays even if AI rewrote it.
  assert.equal(
    mergeGeneratedContent(
      { changes: ["title", "body"], title: "Test", body: "Nowy opis" },
      {
        previousTitle: "test 69",
        previousBody: "Stary opis",
        instruction: "zmień opis na test i daj zdanie o kaktusie",
      },
      1500,
    ).title,
    null,
  );
  assert.ok(instructionAsksForTitle("zmień tytuł na test 69", "Stary"));

  // Picking a photo variant: only the image may change, even if AI rewrote the text.
  const photoPick = mergeGeneratedContent(
    {
      changes: ["body", "image"],
      body: "Przepisana treść",
      newImagePrompt: "fundament budynku",
    },
    {
      previousTitle: "Test",
      previousBody: "Stara treść",
      instruction: "dodaj zdjęcie fundamentu budynku",
      parts: ["image"],
    },
    1500,
  );
  assert.equal(photoPick.body, "Stara treść");
  assert.equal(photoPick.newImagePrompt, "fundament budynku");
  assert.ok(!instructionAsksForTitle("zmień opis na test", "Stary"));
}

console.log("content loop tests passed");
