import assert from "node:assert/strict";
import type { ContentContext } from "../../lib/ai/types";
import {
  contentContextBlock,
  contentUserPrompt,
  topicUserPrompt,
} from "../../lib/ai/content-prompts";
import { mergeAvoid } from "../../lib/brief-avoid";
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
    revision: { previousBody: "Stara treść", instruction: "krócej" },
  });
  assert.match(revision, /Obecna treść posta:\nStara treść/);
  assert.match(revision, /Instrukcja klienta - co zmienić: krócej/);
  assert.doesNotMatch(
    contentUserPrompt({ context, topic: "X" }),
    /Instrukcja klienta/,
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

console.log("content loop tests passed");
