import assert from "node:assert/strict";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { ChannelReviewError } from "../../lib/integrations/channel";
import { FakeReviews, fakeReview, testDatabaseUrl } from "./test-support";

/**
 * Review jobs against a real (local) database with a FAKE channel and FAKE AI:
 * nothing here can reach Google or OpenAI. Needs TEST_DATABASE_URL pointing at
 * a local Postgres; the schema is recreated from the migrations first.
 */

async function main() {
  const url = testDatabaseUrl();
  if (!url) {
    console.log(
      "review database tests skipped (set TEST_DATABASE_URL to a LOCAL Postgres)",
    );
    return;
  }

  // Fresh schema from the real migrations, then load the app modules on it.
  const admin = postgres(url, { prepare: false, onnotice: () => {} });
  await admin`drop schema if exists public cascade`;
  await admin`drop schema if exists drizzle cascade`;
  await admin`create schema public`;
  await migrate(drizzle(admin), { migrationsFolder: "drizzle" });
  await admin.end();
  process.env.DATABASE_URL = url;

  const { db } = await import("../../lib/db");
  const { accounts, profiles, reviews, reviewSyncRuns } =
    await import("../../lib/db/schema");
  const { eq, and } = await import("drizzle-orm");
  const { reviewDeps } = await import("./review-deps");
  const { runReviewSync } = await import("./run-sync");
  const { startReviewSync, loadReviewSyncState, isSyncDue } =
    await import("./sync-control");
  const { generateReviewDraft } = await import("./draft-reviews");
  const { publishReviewReply, deleteReviewReply } =
    await import("./publish-reply");
  const { saveReviewDraft, discardReviewDraft, startEditingReply } =
    await import("./edit-reviews");
  const { changedAfterReply } = await import("./review-rules");

  const T0 = new Date("2026-09-29T12:00:00Z");
  const at = (minutes: number) => new Date(T0.getTime() + minutes * 60_000);
  const day = (n: number) => at(-n * 24 * 60);
  let clock = T0;

  const aiInputs: Array<Record<string, unknown>> = [];
  const generateReply = async (input: Record<string, unknown>) => {
    aiInputs.push(input);
    return `Dziękujemy za ocenę ${input.rating}.`;
  };

  async function makeProfile(
    email: string,
    fake: FakeReviews,
    extra: Partial<typeof profiles.$inferInsert> = {},
  ) {
    const [account] = await db.insert(accounts).values({ email }).returning();
    const [profile] = await db
      .insert(profiles)
      .values({
        accountId: account.id,
        name: `Firma ${email}`,
        gbpLocationId: "locations/1",
        ...extra,
      })
      .returning();
    const deps = reviewDeps({
      db,
      channelFor: () => fake,
      generateReply: generateReply as never,
      now: () => clock,
    });
    return { account, profile, deps };
  }

  async function sync(profileId: string, deps: ReturnType<typeof reviewDeps>) {
    const { runId } = await startReviewSync(profileId, deps);
    await runReviewSync(runId, deps);
    const [run] = await db
      .select()
      .from(reviewSyncRuns)
      .where(eq(reviewSyncRuns.id, runId));
    return run;
  }

  async function row(profileId: string, externalId: string) {
    const [found] = await db
      .select()
      .from(reviews)
      .where(
        and(
          eq(reviews.profileId, profileId),
          eq(reviews.externalId, externalId),
        ),
      );
    return found;
  }

  // =============== 1. pierwszy import, tryb "accept" ===============
  const fakeA = new FakeReviews();
  fakeA.reviews = [
    fakeReview("r1", {
      rating: 5,
      comment: "Świetny serwis",
      createdAt: day(2),
    }),
    fakeReview("r2", { rating: 1, comment: "Fatalnie", createdAt: day(3) }),
    fakeReview("r3", { rating: 5, comment: null, createdAt: day(1) }),
    fakeReview("r4", {
      rating: 4,
      comment:
        "(Translated by Google) Great service.\n\n(Original)\nSuper Service.",
      createdAt: day(5),
    }),
    fakeReview("r5", { rating: 5, comment: "Dawno temu", createdAt: day(90) }),
    fakeReview("r6", {
      rating: 3,
      comment: "Średnio",
      createdAt: day(10),
      reply: { text: "Dziękujemy, pozdrawiamy", updatedAt: day(9) },
    }),
  ];
  const A = await makeProfile("a@test.pl", fakeA);

  clock = T0;
  const run1 = await sync(A.profile.id, A.deps);
  assert.equal(run1.status, "done");
  assert.equal(
    fakeA.fetchCalls,
    3,
    "pierwsza synchronizacja ściąga wszystkie strony",
  );
  assert.equal(run1.fetched, 6);
  assert.equal(run1.newCount, 6);
  assert.equal(Number(run1.averageRating), 4.5);
  assert.equal(run1.totalCount, 6);

  for (const id of ["r1", "r2", "r3", "r4"]) {
    const r = await row(A.profile.id, id);
    assert.equal(r.draftStatus, "ready", `szkic dla ${id}`);
    assert.ok(r.draftText);
    assert.equal(r.replyText, null);
  }
  // stara opinia (>30 dni): bez szkicu, do "Zaproponuj odpowiedź"
  const r5 = await row(A.profile.id, "r5");
  assert.equal(r5.draftStatus, "none");
  assert.equal(r5.draftText, null);
  // odpowiedź dodana w Google: import jako external, AI nie robi szkicu
  const r6 = await row(A.profile.id, "r6");
  assert.equal(r6.replySource, "external");
  assert.equal(r6.replyText, "Dziękujemy, pozdrawiamy");
  assert.equal(r6.draftStatus, "none");
  assert.equal(
    aiInputs.length,
    4,
    "AI tylko dla 4 opinii z ostatnich 30 dni bez odpowiedzi",
  );
  // opinia bez tekstu (same gwiazdki) dostaje szkic; AI dostaje null
  const stars = aiInputs.find(
    (input) => input.rating === 5 && input.reviewText === null,
  );
  assert.ok(stars, "opinia bez tekstu");
  // opinia obcojęzyczna: oryginał + tłumaczenie osobno, surowy tekst w bazie
  const r4 = await row(A.profile.id, "r4");
  assert.equal(r4.commentOriginal, "Super Service.");
  assert.match(r4.comment ?? "", /\(Translated by Google\)/);
  const foreign = aiInputs.find(
    (input) => input.translatedText === "Great service.",
  );
  assert.equal(foreign?.reviewText, "Super Service.");
  assert.equal(fakeA.putCalls.length, 0, "tryb accept nic nie publikuje");

  // =============== 2. druga synchronizacja: tylko pierwsza strona ===============
  clock = at(20);
  fakeA.fetchCalls = 0;
  aiInputs.length = 0;
  const run2 = await sync(A.profile.id, A.deps);
  assert.equal(run2.status, "done");
  assert.equal(
    fakeA.fetchCalls,
    1,
    "bez nowych opinii pobiera tylko pierwszą stronę",
  );
  assert.equal(run2.newCount, 0);
  assert.equal(aiInputs.length, 0);

  // =============== 3. tryb auto: stare szkice nie wychodzą, nowe 3-5* tak ===============
  clock = at(60);
  await db
    .update(profiles)
    .set({ reviewMode: "auto", reviewAutoSince: clock })
    .where(eq(profiles.id, A.profile.id));
  A.profile.reviewMode = "auto";

  clock = at(120);
  fakeA.reviews.push(
    fakeReview("n1", { rating: 5, comment: "Rewelacja", createdAt: at(90) }),
    fakeReview("n2", { rating: 1, comment: "Bardzo źle", createdAt: at(100) }),
    fakeReview("n3", { rating: 3, comment: null, createdAt: at(110) }),
  );
  fakeA.replyTime = at(121);
  const run3 = await sync(A.profile.id, A.deps);
  assert.equal(run3.status, "done");
  const publishedIds = fakeA.putCalls.map((call) => call.externalId).sort();
  assert.deepEqual(
    publishedIds,
    ["n1", "n3"],
    "auto: 5* i 3* (także bez tekstu) tak",
  );
  const n1 = await row(A.profile.id, "n1");
  assert.equal(n1.replySource, "panel");
  assert.ok(n1.replyText);
  assert.equal(n1.draftText, null);
  // 1*: nigdy automatycznie, szkic czeka na decyzję klienta
  const n2 = await row(A.profile.id, "n2");
  assert.equal(n2.replyText, null);
  assert.equal(n2.draftStatus, "ready");
  assert.ok(n2.draftText);
  // opinie sprzed włączenia auto (r1-r4) mają szkice, ale nie zostały opublikowane
  for (const id of ["r1", "r2", "r3", "r4"]) {
    const r = await row(A.profile.id, id);
    assert.equal(
      r.replyText,
      null,
      `${id} sprzed włączenia nie dostaje odpowiedzi`,
    );
    assert.equal(r.draftStatus, "ready");
  }

  // =============== 4. edycja opublikowanej odpowiedzi podmienia, nie dubluje ===============
  const before = (await row(A.profile.id, "n1")).replyText;
  assert.deepEqual(
    await startEditingReply(
      { reviewId: n1.id, profileId: A.profile.id },
      A.deps,
    ),
    { ok: true },
  );
  let editing = await row(A.profile.id, "n1");
  assert.equal(editing.draftText, before);
  assert.equal(editing.replyText, before);
  assert.deepEqual(
    await saveReviewDraft(
      {
        reviewId: n1.id,
        profileId: A.profile.id,
        text: "Nowa wersja odpowiedzi",
      },
      A.deps,
    ),
    { ok: true },
  );
  editing = await row(A.profile.id, "n1");
  assert.equal(
    editing.replyText,
    before,
    "poprawianie szkicu nie rusza opublikowanej odpowiedzi",
  );
  assert.equal(editing.draftText, "Nowa wersja odpowiedzi");
  assert.equal(fakeA.putCalls.filter((c) => c.externalId === "n1").length, 1);

  clock = at(130);
  fakeA.replyTime = at(131);
  assert.deepEqual(
    await publishReviewReply(
      { reviewId: n1.id, profileId: A.profile.id },
      A.deps,
    ),
    { ok: true },
  );
  const replaced = await row(A.profile.id, "n1");
  assert.equal(replaced.replyText, "Nowa wersja odpowiedzi");
  assert.equal(replaced.draftText, null);
  assert.equal(fakeA.putCalls.filter((c) => c.externalId === "n1").length, 2);
  assert.equal(
    fakeA.reviews.find((r) => r.externalId === "n1")?.reply?.text,
    "Nowa wersja odpowiedzi",
    "w Google jest jedna odpowiedź - podmieniona",
  );

  // =============== 5. limit 4096 bajtów (polskie znaki) ===============
  const tooLong = "ą".repeat(2100);
  const blocked = await saveReviewDraft(
    { reviewId: n2.id, profileId: A.profile.id, text: tooLong },
    A.deps,
  );
  assert.equal(blocked.ok, false);
  if (!blocked.ok) assert.match(blocked.error, /bajtów/);
  // nawet jeśli za długi szkic trafił do bazy inną drogą, publikacja go zatrzyma
  await db
    .update(reviews)
    .set({ draftText: tooLong })
    .where(eq(reviews.id, n2.id));
  const attemptsBefore = fakeA.replyAttempts;
  const stopped = await publishReviewReply(
    { reviewId: n2.id, profileId: A.profile.id },
    A.deps,
  );
  assert.equal(stopped.ok, false);
  assert.equal(fakeA.replyAttempts, attemptsBefore, "do Google nic nie wyszło");
  await db
    .update(reviews)
    .set({ draftText: "Przepraszamy za to odczucie. Zapraszamy do kontaktu." })
    .where(eq(reviews.id, n2.id));

  // =============== 6. opinia zmieniona po odpowiedzi ===============
  clock = at(200);
  const changed = fakeA.reviews.find((r) => r.externalId === "n1");
  assert.ok(changed);
  changed.rating = 2;
  changed.comment = "Zmieniam zdanie po rozmowie";
  changed.updatedAt = at(190);
  fakeA.replyTime = at(131);
  await sync(A.profile.id, A.deps);
  const afterChange = await row(A.profile.id, "n1");
  assert.equal(afterChange.rating, 2);
  assert.equal(
    changedAfterReply({
      reviewUpdatedAt: afterChange.reviewUpdatedAt,
      repliedAt: afterChange.repliedAt,
    }),
    true,
    "zmiana autora po odpowiedzi jest oznaczona",
  );
  assert.equal(
    afterChange.replySource,
    "panel",
    "nasza odpowiedź zostaje 'panel'",
  );

  // =============== 7. błąd publikacji w trybie auto: zapisany, bez ponawiania ===============
  clock = at(240);
  fakeA.failReply = new ChannelReviewError(
    "Google pozwala odpowiadać tylko na zweryfikowanej wizytówce",
  );
  fakeA.reviews.push(
    fakeReview("n5", { rating: 5, comment: "Super", createdAt: at(230) }),
  );
  fakeA.replyTime = at(241);
  const attempts = fakeA.replyAttempts;
  await sync(A.profile.id, A.deps);
  const n5 = await row(A.profile.id, "n5");
  assert.equal(n5.replyText, null);
  assert.equal(n5.publishStatus, "failed");
  assert.match(n5.publishError ?? "", /zweryfikowanej/);
  assert.equal(fakeA.replyAttempts, attempts + 1);
  clock = at(300);
  await sync(A.profile.id, A.deps);
  assert.equal(
    fakeA.replyAttempts,
    attempts + 1,
    "nieudana odpowiedź nie jest ponawiana przy każdej synchronizacji",
  );
  fakeA.failReply = null;

  // =============== 8. tryb auto włączony PRZED pierwszym importem ===============
  const fakeB = new FakeReviews();
  fakeB.reviews = [
    fakeReview("b1", { rating: 5, comment: "Dobrze", createdAt: day(2) }),
    fakeReview("b2", { rating: 4, comment: null, createdAt: day(4) }),
  ];
  clock = at(400);
  const B = await makeProfile("b@test.pl", fakeB, {
    reviewMode: "auto",
    reviewAutoSince: clock,
  });
  clock = at(410);
  const runB = await sync(B.profile.id, B.deps);
  assert.equal(runB.status, "done");
  assert.equal(
    fakeB.putCalls.length,
    0,
    "żadna opinia sprzed włączenia nie dostaje odpowiedzi",
  );
  assert.equal((await row(B.profile.id, "b1")).draftStatus, "ready");

  // =============== 9. błąd pobierania i blokada synchronizacji ===============
  const fakeC = new FakeReviews();
  const C = await makeProfile("c@test.pl", fakeC);
  fakeC.failFetch = new ChannelReviewError(
    "Autoryzacja Google wygasła - połącz ponownie wizytówkę",
  );
  clock = at(500);
  const failed = await sync(C.profile.id, C.deps);
  assert.equal(failed.status, "failed");
  assert.match(failed.error ?? "", /wygasła/);
  const state = await loadReviewSyncState(C.profile.id, C.deps);
  assert.equal(state.running, false);
  assert.match(state.lastError ?? "", /wygasła/);
  assert.equal(state.lastSyncedAt, null);

  const first = await startReviewSync(C.profile.id, C.deps);
  const second = await startReviewSync(C.profile.id, C.deps);
  assert.equal(first.started, true);
  assert.equal(second.started, false, "jeden running na profil");
  assert.equal(second.runId, first.runId);
  // zawieszony przebieg (> 10 min) jest zamykany jako failed i nie blokuje
  clock = at(520);
  const third = await startReviewSync(C.profile.id, C.deps);
  assert.equal(third.started, true);
  const [swept] = await db
    .select()
    .from(reviewSyncRuns)
    .where(eq(reviewSyncRuns.id, first.runId));
  assert.equal(swept.status, "failed");
  await db
    .update(reviewSyncRuns)
    .set({ status: "done", finishedAt: clock })
    .where(eq(reviewSyncRuns.id, third.runId));

  // kiedy synchronizować przy wejściu na /opinie
  const finished = (minutesAgo: number, status: "done" | "failed") => ({
    status,
    startedAt: at(-minutesAgo),
    finishedAt: at(-minutesAgo),
  });
  assert.equal(isSyncDue([], T0), true);
  assert.equal(isSyncDue([finished(5, "done")], T0), false);
  assert.equal(isSyncDue([finished(16, "done")], T0), true);
  assert.equal(
    isSyncDue([finished(5, "failed")], T0),
    false,
    "nieudana nie jest ponawiana przy każdym wejściu",
  );
  assert.equal(
    isSyncDue([{ status: "running", startedAt: at(-2), finishedAt: null }], T0),
    false,
  );
  // zawieszony przebieg liczy się jak nieudany (od chwili, gdy stał się "stary"):
  // 11 min od startu - jeszcze świeżo, 26 min - czas spróbować ponownie
  assert.equal(
    isSyncDue(
      [{ status: "running", startedAt: at(-11), finishedAt: null }],
      T0,
    ),
    false,
  );
  assert.equal(
    isSyncDue(
      [{ status: "running", startedAt: at(-26), finishedAt: null }],
      T0,
    ),
    true,
  );

  // =============== 10. izolacja: cudze opinie są "nie znalezione" ===============
  const foreignReview = await row(B.profile.id, "b1");
  const put = fakeB.putCalls.length;
  const attemptsB = fakeB.replyAttempts;
  assert.deepEqual(
    await publishReviewReply(
      { reviewId: foreignReview.id, profileId: A.profile.id },
      A.deps,
    ),
    { ok: false, error: "Nie znaleziono opinii" },
  );
  assert.deepEqual(
    await generateReviewDraft(
      { reviewId: foreignReview.id, profileId: A.profile.id },
      A.deps,
    ),
    { ok: false, error: "Nie znaleziono opinii" },
  );
  assert.equal(
    (
      await saveReviewDraft(
        {
          reviewId: foreignReview.id,
          profileId: A.profile.id,
          text: "Podmiana",
        },
        A.deps,
      )
    ).ok,
    false,
  );
  assert.equal(
    (
      await discardReviewDraft(
        { reviewId: foreignReview.id, profileId: A.profile.id },
        A.deps,
      )
    ).ok,
    false,
  );
  assert.equal(
    (
      await deleteReviewReply(
        { reviewId: foreignReview.id, profileId: A.profile.id },
        A.deps,
      )
    ).ok,
    false,
  );
  assert.equal(fakeB.putCalls.length, put);
  assert.equal(
    fakeB.replyAttempts,
    attemptsB,
    "żadne wywołanie kanału dla cudzej opinii",
  );
  const untouched = await row(B.profile.id, "b1");
  assert.equal(
    untouched.draftText,
    foreignReview.draftText,
    "cudzy szkic nietknięty",
  );

  // =============== 11. ręczne "Zaproponuj odpowiedź" dla starej opinii ===============
  aiInputs.length = 0;
  const r5again = await row(A.profile.id, "r5");
  const manual = await generateReviewDraft(
    {
      reviewId: r5again.id,
      profileId: A.profile.id,
      oneOffInstruction: "odpowiedz krócej",
    },
    A.deps,
  );
  assert.equal(manual.ok, true);
  assert.equal(aiInputs[0].oneOffInstruction, "odpowiedz krócej");
  // opinia z odpowiedzią: AI nie proponuje
  const answered = await row(A.profile.id, "r6");
  assert.deepEqual(
    await generateReviewDraft(
      { reviewId: answered.id, profileId: A.profile.id },
      A.deps,
    ),
    { ok: false, error: "Ta opinia ma już odpowiedź" },
  );

  // =============== 12. usunięcie odpowiedzi ===============
  const del = await deleteReviewReply(
    { reviewId: n1.id, profileId: A.profile.id },
    A.deps,
  );
  assert.deepEqual(del, { ok: true });
  const cleared = await row(A.profile.id, "n1");
  assert.equal(cleared.replyText, null);
  assert.deepEqual(fakeA.deleteCalls, ["n1"]);

  // =============== 12b. wytyczne osobno dla ocen ===============
  const fakeD = new FakeReviews();
  fakeD.reviews = [
    fakeReview("d1", { rating: 2, comment: "Slabo", createdAt: day(1) }),
    fakeReview("d2", { rating: 5, comment: "Super", createdAt: day(2) }),
    fakeReview("d3", { rating: 4, comment: null, createdAt: day(3) }),
  ];
  clock = at(600);
  const D = await makeProfile("d@test.pl", fakeD, {
    reviewReplyInstructions: "Wspólne",
    reviewRatingInstructions: {
      "2": "Wytyczna dla dwójki",
      "5": "Wytyczna dla piątki",
    },
  });
  aiInputs.length = 0;
  await sync(D.profile.id, D.deps);
  const forTwo = aiInputs.find((input) => input.rating === 2);
  const forFive = aiInputs.find((input) => input.rating === 5);
  const forFour = aiInputs.find((input) => input.rating === 4);
  assert.equal(forTwo?.ratingInstructions, "Wytyczna dla dwójki");
  assert.equal(forFive?.ratingInstructions, "Wytyczna dla piątki");
  assert.equal(
    forFour?.ratingInstructions,
    null,
    "ocena bez wytycznych nie dostaje cudzych",
  );
  assert.equal(
    forTwo?.instructions,
    "Wspólne",
    "wspólne wytyczne dochodzą obok",
  );
  // domyślnie zespół + ciepły styl; ustawienia profilu docierają do AI
  assert.equal(forTwo?.perspective, "team");
  assert.equal(forTwo?.style, "warm");
  // ręczne "Wygeneruj ponownie" też używa wytycznych oceny opinii
  aiInputs.length = 0;
  await db
    .update(reviews)
    .set({ draftText: null, draftStatus: "none" })
    .where(eq(reviews.profileId, D.profile.id));
  const d1 = await row(D.profile.id, "d1");
  await generateReviewDraft(
    { reviewId: d1.id, profileId: D.profile.id },
    D.deps,
  );
  assert.equal(aiInputs[0].ratingInstructions, "Wytyczna dla dwójki");
  // tryb auto nadal nie publikuje 1-2 gwiazdek, choć ma wytyczne
  await db
    .update(profiles)
    .set({ reviewMode: "auto", reviewAutoSince: at(590) })
    .where(eq(profiles.id, D.profile.id));
  D.profile.reviewMode = "auto";
  const putBefore = fakeD.putCalls.length;
  await sync(D.profile.id, D.deps);
  assert.equal(
    fakeD.putCalls.some((call) => call.externalId === "d1"),
    false,
  );
  assert.ok(fakeD.putCalls.length >= putBefore);

  // =============== 12c. perspektywa i styl z profilu trafiają do AI ===============
  const fakeE = new FakeReviews();
  fakeE.reviews = [
    fakeReview("e1", { rating: 5, comment: "Super", createdAt: day(1) }),
  ];
  clock = at(700);
  const E = await makeProfile("e@test.pl", fakeE, {
    reviewPerspective: "owner",
    reviewStyle: "formal",
  });
  aiInputs.length = 0;
  await sync(E.profile.id, E.deps);
  assert.equal(aiInputs[0]?.perspective, "owner");
  assert.equal(aiInputs[0]?.style, "formal");

  // =============== 13. izolacja: listy i liczniki tylko własnego profilu ===============
  const { loadReviews, countPendingReviews } = await import("./load-reviews");
  const { loadPulpitReviews } = await import("./load-pulpit-reviews");
  const all = { status: "all", rating: "all", limit: 500 } as const;
  const listA = await loadReviews({ id: A.profile.id }, all, clock);
  const listB = await loadReviews({ id: B.profile.id }, all, clock);
  const listC = await loadReviews({ id: C.profile.id }, all, clock);
  const idsA = new Set(listA.items.map((item) => item.id));
  assert.ok(listA.items.length >= 8 && listB.items.length === 2);
  assert.equal(
    listB.items.some((item) => idsA.has(item.id)),
    false,
    "lista profilu B nie zawiera opinii profilu A",
  );
  assert.equal(listC.items.length, 0);
  assert.equal(listB.total, 2);
  assert.equal(await countPendingReviews({ id: B.profile.id }), 2);
  assert.equal(await countPendingReviews({ id: C.profile.id }), 0);
  const pulpitC = await loadPulpitReviews({ id: C.profile.id }, clock);
  assert.deepEqual(pulpitC, { pending: 0, lastWeek: 0, items: [] });
  const pulpitB = await loadPulpitReviews({ id: B.profile.id }, clock);
  assert.equal(pulpitB.pending, 2);
  assert.ok(pulpitB.items.every((item) => item.authorName === "Anna"));
  // ustawienia trybu są kolumnami samego profilu - inne konto ich nie odczyta
  const [settingsB] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.id, B.profile.id));
  assert.equal(settingsB.reviewMode, "auto");
  assert.equal(settingsB.accountId, B.account.id);
  assert.notEqual(settingsB.accountId, A.account.id);

  await db.$client.end();
  console.log("review database tests passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
