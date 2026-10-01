"use server";

import { and, desc, eq, gte, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { getTextProvider } from "@/lib/ai";
import { defaultImagePrompt, GBP_POST_MAX } from "@/lib/ai/content-prompts";
import { appendBriefAvoid } from "@/lib/brief";
import { db } from "@/lib/db";
import {
  contentChannelEnum,
  contentGenerationRuns,
  contentItems,
  contentTopics,
  contentRevisions,
  contentTargets,
  type ContentItem,
  type ContentTargetStatus,
  type Profile,
} from "@/lib/db/schema";
import { isChannelAvailable } from "@/lib/integrations/publishers";
import {
  deletePublicImage,
  putPublicImage,
  publicImageKeyFromUrl,
  StorageNotConfiguredError,
} from "@/lib/storage";
import {
  AuthError,
  getActiveProfile,
  listAccountProfileOptions,
  requireOwnedProfile,
} from "@/lib/session";
import { loadContentContext } from "@/features/publikacje/content-context";
import {
  createPostImage,
  enqueueContentGeneration,
} from "@/features/publikacje/generate";
import {
  checkTopicSelection,
  TOPICS_BATCH,
} from "@/features/publikacje/generation-rules";
import { TOPIC_MAX } from "@/lib/ai/topic-list";
import {
  checkManualPost,
  manualEditLabel,
} from "@/features/publikacje/manual-post-rules";
import { resolveGroupTargets } from "@/features/publikacje/group-targets";
import {
  loadContentScope,
  ownedByScope,
  runsInScope,
  topicsInScope,
} from "@/features/publikacje/scope";
import { initialTargetStatus } from "@/features/publikacje/publish-core";
import { publishTargets } from "@/features/publikacje/publish";

type ActionFail = { ok: false; error: string };

function fail(error: unknown): ActionFail {
  if (
    error instanceof AuthError ||
    error instanceof StorageNotConfiguredError
  ) {
    return { ok: false, error: error.message };
  }
  console.error("Publikacje action failed:", error);
  return {
    ok: false,
    error:
      error instanceof Error && error.message.includes("OPENAI_API_KEY")
        ? "Brak konfiguracji AI"
        : "Coś poszło nie tak - spróbuj ponownie",
  };
}

function revalidateModule() {
  revalidatePath("/publikacje", "layout");
  revalidatePath("/pulpit");
}

/** Item owned by the active profile or shared by its group, else AuthError. */
async function getOwnedItem(
  profile: Profile,
  itemId: string,
): Promise<ContentItem> {
  const scope = await loadContentScope(profile);
  const [item] = await db
    .select()
    .from(contentItems)
    .where(and(eq(contentItems.id, itemId), ownedByScope(scope)))
    .limit(1);
  if (!item) throw new AuthError("Publikacja nie istnieje", 404);
  return item;
}

async function requirePending(profile: Profile, itemId: string) {
  const item = await getOwnedItem(profile, itemId);
  if (item.status !== "pending") {
    throw new AuthError("Ta propozycja jest już rozpatrzona", 409);
  }
  return item;
}

// --- Propozycje (generowanie w tle) ---

// --- Tematy postów (wybór przed pisaniem) ---

const topicTitleSchema = z.string().trim().min(3).max(TOPIC_MAX);

/** A topic of the active profile / its group that is still on the list. */
async function requireOpenTopic(profile: Profile, topicId: string) {
  const scope = await loadContentScope(profile);
  const [topic] = await db
    .select()
    .from(contentTopics)
    .where(
      and(
        eq(contentTopics.id, topicId),
        topicsInScope(scope),
        eq(contentTopics.status, "open"),
      ),
    )
    .limit(1);
  if (!topic) throw new AuthError("Temat nie istnieje", 404);
  return topic;
}

/** "Zaproponuj kolejne tematy" - AI adds 5 topics in the background. */
export async function suggestTopics(): Promise<
  { ok: true; runId: string } | ActionFail
> {
  try {
    const profile = await getActiveProfile();
    const scope = await loadContentScope(profile);
    const runId = await enqueueContentGeneration({
      profile,
      scope,
      kind: "topics",
      count: TOPICS_BATCH,
    });
    revalidateModule();
    return { ok: true, runId };
  } catch (error) {
    return fail(error);
  }
}

/** Customer's own topic, added to the list. */
export async function addTopic(
  input: unknown,
): Promise<{ ok: true; topicId: string } | ActionFail> {
  const parsed = z.object({ title: topicTitleSchema }).safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: `Temat musi mieć od 3 do ${TOPIC_MAX} znaków` };
  }
  try {
    const profile = await getActiveProfile();
    const scope = await loadContentScope(profile);
    const [topic] = await db
      .insert(contentTopics)
      .values({
        profileId: profile.id,
        groupId: scope.groupId,
        title: parsed.data.title,
        origin: "manual",
      })
      .returning({ id: contentTopics.id });
    revalidateModule();
    return { ok: true, topicId: topic.id };
  } catch (error) {
    return fail(error);
  }
}

export async function updateTopic(
  input: unknown,
): Promise<{ ok: true; title: string } | ActionFail> {
  const parsed = z
    .object({ topicId: z.string().uuid(), title: topicTitleSchema })
    .safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: `Temat musi mieć od 3 do ${TOPIC_MAX} znaków` };
  }
  try {
    const profile = await getActiveProfile();
    const topic = await requireOpenTopic(profile, parsed.data.topicId);
    await db
      .update(contentTopics)
      .set({ title: parsed.data.title })
      .where(eq(contentTopics.id, topic.id));
    revalidateModule();
    return { ok: true, title: parsed.data.title };
  } catch (error) {
    return fail(error);
  }
}

/** Removes a topic from the list (kept in the database as dismissed). */
export async function dismissTopic(
  input: unknown,
): Promise<{ ok: true } | ActionFail> {
  const parsed = z.object({ topicId: z.string().uuid() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Niepoprawne dane" };
  try {
    const profile = await getActiveProfile();
    const topic = await requireOpenTopic(profile, parsed.data.topicId);
    await db
      .update(contentTopics)
      .set({ status: "dismissed" })
      .where(eq(contentTopics.id, topic.id));
    revalidateModule();
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

/** "Napisz posty" - one post per chosen topic (1-10), in the background. */
export async function writePostsFromTopics(
  input: unknown,
): Promise<{ ok: true; runId: string; count: number } | ActionFail> {
  const parsed = z
    .object({ topicIds: z.array(z.string().uuid()).max(50) })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "Niepoprawne dane" };
  const selection = checkTopicSelection(parsed.data.topicIds);
  if (!selection.ok) return { ok: false, error: selection.error };

  try {
    const profile = await getActiveProfile();
    const scope = await loadContentScope(profile);
    // Every id must be an open topic of this profile / group - never trust the list.
    const owned = await db
      .select({ id: contentTopics.id })
      .from(contentTopics)
      .where(
        and(
          inArray(contentTopics.id, selection.ids),
          topicsInScope(scope),
          eq(contentTopics.status, "open"),
        ),
      );
    if (owned.length !== selection.ids.length) {
      return {
        ok: false,
        error: "Któryś temat nie jest już dostępny - odśwież listę",
      };
    }

    const runId = await enqueueContentGeneration({
      profile,
      scope,
      kind: "posts",
      topicIds: selection.ids,
    });
    revalidateModule();
    return { ok: true, runId, count: selection.ids.length };
  } catch (error) {
    return fail(error);
  }
}

const chatMessageSchema = z.object({
  message: z.string().trim().min(1).max(1000),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        text: z.string().trim().min(1).max(1000),
      }),
    )
    .max(8)
    .default([]),
});

const ROUTER_POSTS = 20;
const EXCERPT = 160;

export type ChatRouteResult =
  | { ok: true; kind: "create"; runId: string; count: number }
  | {
      ok: true;
      kind: "edit";
      itemId: string;
      itemTitle: string;
      instruction: string;
    }
  | { ok: true; kind: "clarify"; question: string }
  | { ok: true; kind: "reply"; text: string };

/**
 * Chat without a selected post: AI decides whether the message asks for new
 * posts (starts a background run) or a change to one of the pending posts.
 */
export async function routeChatMessage(
  input: unknown,
): Promise<ChatRouteResult | ActionFail> {
  const parsed = chatMessageSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: "Napisz, czego potrzebujesz" };

  try {
    const profile = await getActiveProfile();
    const scope = await loadContentScope(profile);
    const pending = await db
      .select({
        id: contentItems.id,
        title: contentItems.title,
        body: contentItems.body,
      })
      .from(contentItems)
      .where(and(ownedByScope(scope), eq(contentItems.status, "pending")))
      .orderBy(desc(contentItems.createdAt))
      .limit(ROUTER_POSTS);

    const intent = await getTextProvider().routeContentChat({
      context: await loadContentContext(profile),
      message: parsed.data.message,
      history: parsed.data.history,
      posts: pending.map((post) => ({
        id: post.id,
        title: post.title,
        excerpt: post.body.slice(0, EXCERPT),
      })),
    });

    if (intent.kind === "edit") {
      return {
        ok: true,
        kind: "edit",
        itemId: intent.postId,
        itemTitle:
          pending.find((post) => post.id === intent.postId)?.title ?? "",
        instruction: intent.instruction,
      };
    }
    if (intent.kind === "clarify") {
      return { ok: true, kind: "clarify", question: intent.question };
    }
    if (intent.kind === "reply") {
      return { ok: true, kind: "reply", text: intent.text };
    }

    const runId = await enqueueContentGeneration({
      profile,
      scope,
      count: intent.count,
      request: intent.request,
    });
    revalidateModule();
    return { ok: true, kind: "create", runId, count: intent.count };
  } catch (error) {
    return fail(error);
  }
}

export type GenerationStatus = {
  id: string;
  kind: "posts" | "topics";
  status: "running" | "done" | "failed";
  requested: number;
  created: number;
  error: string | null;
};

/** Background runs of the active profile / its group started in the last hour. */
export async function getGenerationStatus(
  input?: unknown,
): Promise<{ ok: true; runs: GenerationStatus[] } | ActionFail> {
  const parsed = z
    .object({ runIds: z.array(z.string().uuid()).max(20).optional() })
    .safeParse(input ?? {});
  if (!parsed.success) return { ok: false, error: "Niepoprawne dane" };

  try {
    const profile = await getActiveProfile();
    const scope = await loadContentScope(profile);
    const runs = await db
      .select({
        id: contentGenerationRuns.id,
        kind: contentGenerationRuns.kind,
        status: contentGenerationRuns.status,
        requested: contentGenerationRuns.requested,
        created: contentGenerationRuns.created,
        error: contentGenerationRuns.error,
      })
      .from(contentGenerationRuns)
      .where(
        and(
          runsInScope(scope),
          gte(
            contentGenerationRuns.startedAt,
            new Date(Date.now() - 3_600_000),
          ),
          parsed.data.runIds?.length
            ? inArray(contentGenerationRuns.id, parsed.data.runIds)
            : eq(contentGenerationRuns.status, "running"),
        ),
      )
      .orderBy(desc(contentGenerationRuns.startedAt));
    return { ok: true, runs };
  } catch (error) {
    return fail(error);
  }
}

// --- Akceptacja i publikacja ---

const acceptSchema = z.object({
  itemId: z.string().uuid(),
  channels: z.array(z.enum(contentChannelEnum.enumValues)).min(1).max(3),
  extraProfileIds: z.array(z.string().uuid()).max(50).default([]),
  scheduledAt: z.string().datetime({ offset: true }).nullable().optional(),
});

export async function acceptContent(
  input: unknown,
): Promise<{ ok: true; status: ContentTargetStatus } | ActionFail> {
  const parsed = acceptSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Niepoprawne dane" };

  try {
    const profile = await getActiveProfile();
    const item = await requirePending(profile, parsed.data.itemId);

    const channels = [...new Set(parsed.data.channels)];
    if (channels.some((channel) => !isChannelAvailable(channel))) {
      return { ok: false, error: "Ten kanał będzie dostępny wkrótce" };
    }

    // Every target profile is verified against the active account, one by one.
    const extraIds = resolveGroupTargets(
      profile.id,
      parsed.data.extraProfileIds,
      await listAccountProfileOptions(),
    );
    for (const id of extraIds) await requireOwnedProfile(id);

    const scheduledAt = parsed.data.scheduledAt
      ? new Date(parsed.data.scheduledAt)
      : null;
    if (scheduledAt && scheduledAt.getTime() < Date.now() - 60_000) {
      return { ok: false, error: "Data publikacji jest w przeszłości" };
    }

    const status = initialTargetStatus(scheduledAt);
    const targetRows = [profile.id, ...extraIds].flatMap((profileId) =>
      channels.map((channel) => ({
        contentItemId: item.id,
        profileId,
        channel,
        status,
        scheduledAt,
      })),
    );

    await db.transaction(async (tx) => {
      await tx.insert(contentTargets).values(targetRows).onConflictDoNothing();
      await tx
        .update(contentItems)
        .set({ status: "accepted", updatedAt: new Date() })
        .where(eq(contentItems.id, item.id));
    });

    if (status === "queued") {
      const itemId = item.id;
      // TODO: przenieść do kolejki BullMQ (Faza 5)
      after(() => {
        void publishTargets(itemId);
      });
    }

    revalidateModule();
    return { ok: true, status };
  } catch (error) {
    return fail(error);
  }
}

/** Publication status per target - polled by the UI after accepting. */
export async function getContentPublishStatus(input: unknown): Promise<
  | {
      ok: true;
      targets: Array<{
        profileId: string;
        channel: string;
        status: ContentTargetStatus;
        error: string | null;
      }>;
    }
  | ActionFail
> {
  const parsed = z.object({ itemId: z.string().uuid() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Niepoprawne dane" };

  try {
    const profile = await getActiveProfile();
    const item = await getOwnedItem(profile, parsed.data.itemId);
    const targets = await db
      .select({
        profileId: contentTargets.profileId,
        channel: contentTargets.channel,
        status: contentTargets.status,
        error: contentTargets.error,
      })
      .from(contentTargets)
      .where(eq(contentTargets.contentItemId, item.id));
    return { ok: true, targets };
  } catch (error) {
    return fail(error);
  }
}

// --- Zaplanowane: zmiana terminu i anulowanie ---

/**
 * Scheduled targets of the item on the active account's profiles - only those
 * still waiting (status "scheduled"), never already published ones.
 */
async function scheduledTargetsFilter(profile: Profile, itemId: string) {
  const item = await getOwnedItem(profile, itemId);
  const accountProfileIds = (await listAccountProfileOptions()).map(
    (option) => option.id,
  );
  return {
    item,
    where: and(
      eq(contentTargets.contentItemId, item.id),
      eq(contentTargets.status, "scheduled"),
      inArray(contentTargets.profileId, accountProfileIds),
    ),
  };
}

const rescheduleSchema = z.object({
  itemId: z.string().uuid(),
  scheduledAt: z.string().datetime({ offset: true }),
});

/** New date for a scheduled post (all its scheduled channels and profiles). */
export async function rescheduleContent(
  input: unknown,
): Promise<{ ok: true } | ActionFail> {
  const parsed = rescheduleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Niepoprawne dane" };

  const scheduledAt = new Date(parsed.data.scheduledAt);
  if (initialTargetStatus(scheduledAt) !== "scheduled") {
    return { ok: false, error: "Nowy termin musi być w przyszłości" };
  }

  try {
    const profile = await getActiveProfile();
    const { where } = await scheduledTargetsFilter(profile, parsed.data.itemId);
    const updated = await db
      .update(contentTargets)
      .set({ scheduledAt })
      .where(where)
      .returning({ id: contentTargets.id });
    if (updated.length === 0) {
      return { ok: false, error: "Ten post nie jest już zaplanowany" };
    }
    revalidateModule();
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

/**
 * Cancels a scheduled post: its scheduled targets are removed and, when
 * nothing else of it went out, the post goes back to "Do akceptacji".
 */
export async function cancelScheduledContent(
  input: unknown,
): Promise<{ ok: true } | ActionFail> {
  const parsed = z.object({ itemId: z.string().uuid() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Niepoprawne dane" };

  try {
    const profile = await getActiveProfile();
    const { item, where } = await scheduledTargetsFilter(
      profile,
      parsed.data.itemId,
    );
    const removed = await db.transaction(async (tx) => {
      const rows = await tx
        .delete(contentTargets)
        .where(where)
        .returning({ id: contentTargets.id });
      if (rows.length === 0) return 0;
      const [left] = await tx
        .select({ id: contentTargets.id })
        .from(contentTargets)
        .where(eq(contentTargets.contentItemId, item.id))
        .limit(1);
      if (!left) {
        await tx
          .update(contentItems)
          .set({ status: "pending", updatedAt: new Date() })
          .where(eq(contentItems.id, item.id));
      }
      return rows.length;
    });
    if (removed === 0) {
      return { ok: false, error: "Ten post nie jest już zaplanowany" };
    }
    revalidateModule();
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

// --- Posty i zdjęcia ręcznie ---

/** The uploaded file from a form, or null when none was chosen. */
async function readImageFile(
  formData: FormData,
): Promise<{ bytes: Uint8Array; type: string } | null> {
  const file = formData.get("image");
  if (!(file instanceof File) || file.size === 0) return null;
  return { bytes: new Uint8Array(await file.arrayBuffer()), type: file.type };
}

/** Customer's own post: text pasted by hand, optional own photo. */
export async function createManualPost(
  formData: FormData,
): Promise<{ ok: true; itemId: string } | ActionFail> {
  const check = checkManualPost({
    title: String(formData.get("title") ?? ""),
    body: String(formData.get("body") ?? ""),
  });
  if (!check.ok) return { ok: false, error: check.error };

  try {
    const profile = await getActiveProfile();
    const scope = await loadContentScope(profile);
    const file = await readImageFile(formData);
    // Upload first - a failed photo must not leave a half-made post.
    const image = file
      ? await putPublicImage(file.bytes, file.type, { profileId: profile.id })
      : null;

    const [item] = await db
      .insert(contentItems)
      .values({
        profileId: profile.id,
        groupId: scope.groupId,
        type: "post",
        origin: "manual",
        status: "pending",
        topic: check.title,
        title: check.title,
        body: check.body,
        imageUrl: image?.url ?? null,
        imageKey: image?.key ?? null,
      })
      .returning({ id: contentItems.id });

    revalidateModule();
    return { ok: true, itemId: item.id };
  } catch (error) {
    return fail(error);
  }
}

const textSchema = z.object({
  itemId: z.string().uuid(),
  title: z.string().max(2000),
  body: z.string().max(5000),
});

/** Inline edit of title / text; the previous version goes to history. */
export async function updatePostText(
  input: unknown,
): Promise<{ ok: true; title: string; body: string } | ActionFail> {
  const parsed = textSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Niepoprawne dane" };
  const check = checkManualPost(parsed.data);
  if (!check.ok) return { ok: false, error: check.error };

  try {
    const profile = await getActiveProfile();
    const item = await requirePending(profile, parsed.data.itemId);
    const titleChanged = check.title !== item.title;
    const bodyChanged = check.body !== item.body;
    if (!titleChanged && !bodyChanged) {
      return { ok: true, title: item.title, body: item.body };
    }

    await db.transaction(async (tx) => {
      await tx.insert(contentRevisions).values({
        contentItemId: item.id,
        title: titleChanged ? item.title : null,
        body: item.body,
        imageUrl: item.imageUrl,
        instruction: manualEditLabel(titleChanged, bodyChanged),
      });
      await tx
        .update(contentItems)
        .set({ title: check.title, body: check.body, updatedAt: new Date() })
        .where(eq(contentItems.id, item.id));
    });

    revalidateModule();
    return { ok: true, title: check.title, body: check.body };
  } catch (error) {
    return fail(error);
  }
}

/** Customer's own photo for a post (new or replacing the current one). */
export async function uploadPostImage(
  formData: FormData,
): Promise<{ ok: true; imageUrl: string } | ActionFail> {
  const itemId = z.string().uuid().safeParse(formData.get("itemId"));
  if (!itemId.success) return { ok: false, error: "Niepoprawne dane" };

  try {
    const profile = await getActiveProfile();
    const item = await requirePending(profile, itemId.data);
    const file = await readImageFile(formData);
    if (!file) return { ok: false, error: "Wybierz zdjęcie" };
    const image = await putPublicImage(file.bytes, file.type, {
      profileId: profile.id,
    });

    await db.transaction(async (tx) => {
      await tx.insert(contentRevisions).values({
        contentItemId: item.id,
        body: item.body,
        imageUrl: item.imageUrl,
        instruction: item.imageUrl
          ? "Podmiana na własne zdjęcie"
          : "Własne zdjęcie",
      });
      await tx
        .update(contentItems)
        .set({
          imageUrl: image.url,
          imageKey: image.key,
          updatedAt: new Date(),
        })
        .where(eq(contentItems.id, item.id));
    });

    revalidateModule();
    return { ok: true, imageUrl: image.url };
  } catch (error) {
    return fail(error);
  }
}

/** Removes the post's image (kept in storage - "Cofnij" can bring it back). */
export async function removePostImage(
  input: unknown,
): Promise<{ ok: true } | ActionFail> {
  const parsed = z.object({ itemId: z.string().uuid() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Niepoprawne dane" };

  try {
    const profile = await getActiveProfile();
    const item = await requirePending(profile, parsed.data.itemId);
    if (!item.imageUrl) return { ok: true };

    await db.transaction(async (tx) => {
      await tx.insert(contentRevisions).values({
        contentItemId: item.id,
        body: item.body,
        imageUrl: item.imageUrl,
        instruction: "Usunięto zdjęcie",
      });
      await tx
        .update(contentItems)
        .set({ imageUrl: null, imageKey: null, updatedAt: new Date() })
        .where(eq(contentItems.id, item.id));
    });

    revalidateModule();
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

// --- Grafika na żądanie ---

export async function generateContentImage(
  input: unknown,
): Promise<{ ok: true; imageUrl: string } | ActionFail> {
  const parsed = z.object({ itemId: z.string().uuid() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Niepoprawne dane" };

  try {
    const profile = await getActiveProfile();
    const item = await requirePending(profile, parsed.data.itemId);
    const context = await loadContentContext(profile);
    const image = await createPostImage(
      profile.id,
      defaultImagePrompt(context, item.title),
    );
    await db
      .update(contentItems)
      .set({ imageUrl: image.url, imageKey: image.key, updatedAt: new Date() })
      .where(eq(contentItems.id, item.id));
    // Old image stays in storage - a revision may still point at it.

    revalidateModule();
    return { ok: true, imageUrl: image.url };
  } catch (error) {
    return fail(error);
  }
}

// --- Odrzucenie ---

const rejectSchema = z.object({
  itemId: z.string().uuid(),
  reason: z.string().trim().max(500).optional(),
});

export async function rejectContent(
  input: unknown,
): Promise<{ ok: true } | ActionFail> {
  const parsed = rejectSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Niepoprawne dane" };

  try {
    const profile = await getActiveProfile();
    const item = await requirePending(profile, parsed.data.itemId);
    await db
      .update(contentItems)
      .set({ status: "rejected", updatedAt: new Date() })
      .where(eq(contentItems.id, item.id));
    await appendBriefAvoid(profile.id, parsed.data.reason);

    revalidateModule();
    revalidatePath("/ustawienia/kontekst");
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

// --- Edycja przez czat ---

const turnSchema = z.object({
  role: z.enum(["user", "assistant"]),
  text: z.string().trim().min(1).max(2000),
});

const postChatSchema = z.object({
  itemId: z.string().uuid(),
  message: z.string().trim().min(1).max(1000),
  /** Earlier turns of this chat (general + edit), oldest first */
  conversation: z.array(turnSchema).max(12).default([]),
});

const POST_HISTORY = 10;

/** Saved requests that changed this post (content_revisions), oldest first. */
async function savedInstructions(itemId: string): Promise<string[]> {
  const rows = await db
    .select({ instruction: contentRevisions.instruction })
    .from(contentRevisions)
    .where(eq(contentRevisions.contentItemId, itemId))
    .orderBy(desc(contentRevisions.createdAt))
    .limit(POST_HISTORY);
  return rows.map((row) => row.instruction).reverse();
}

/**
 * Chat about one post. AI answers (ideas, variants, opinion - nothing
 * changes) or, when the customer explicitly asks for a change, prepares a
 * version to compare. Nothing is saved until applyContentRevision.
 */
export async function chatAboutPost(input: unknown): Promise<
  | { ok: true; kind: "reply"; text: string }
  | {
      ok: true;
      kind: "proposal";
      /** Self-contained change request (saved in content_revisions) */
      instruction: string;
      body: string;
      /** New title when the customer asked for one, else null (unchanged) */
      title: string | null;
      /** Description of the new image, else null */
      newImagePrompt: string | null;
    }
  | ActionFail
> {
  const parsed = postChatSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Napisz wiadomość" };

  try {
    const profile = await getActiveProfile();
    const item = await requirePending(profile, parsed.data.itemId);
    const context = await loadContentContext(profile);
    const ai = getTextProvider();

    const answer = await ai.respondToPostChat({
      context,
      post: {
        title: item.title,
        body: item.body,
        hasImage: Boolean(item.imageUrl),
      },
      conversation: parsed.data.conversation,
      message: parsed.data.message,
    });
    if (answer.kind === "reply") {
      return { ok: true, kind: "reply", text: answer.text };
    }

    const content = await ai.generateContent({
      context,
      topic: item.topic,
      channel: "wizytówka Google",
      revision: {
        previousTitle: item.title,
        previousBody: item.body,
        instruction: answer.instruction,
        parts: answer.parts,
        history: [
          ...new Set([
            ...(await savedInstructions(item.id)),
            ...parsed.data.conversation
              .filter((turn) => turn.role === "user")
              .map((turn) => turn.text),
          ]),
        ].slice(-POST_HISTORY),
      },
    });
    return {
      ok: true,
      kind: "proposal",
      instruction: answer.instruction,
      body: content.body,
      title: content.title,
      newImagePrompt: content.newImagePrompt,
    };
  } catch (error) {
    return fail(error);
  }
}

const applySchema = z.object({
  itemId: z.string().uuid(),
  instruction: z.string().trim().min(2).max(2000),
  body: z.string().trim().min(1).max(GBP_POST_MAX),
  title: z.string().trim().min(1).max(160).nullable().optional(),
  newImagePrompt: z.string().trim().max(1000).nullable().optional(),
});

/** Saves the previewed version; the previous one goes to content_revisions. */
export async function applyContentRevision(
  input: unknown,
): Promise<
  | { ok: true; title: string; body: string; imageUrl: string | null }
  | ActionFail
> {
  const parsed = applySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Niepoprawne dane" };

  try {
    const profile = await getActiveProfile();
    const item = await requirePending(profile, parsed.data.itemId);

    const image = parsed.data.newImagePrompt
      ? await createPostImage(
          profile.id,
          `${parsed.data.newImagePrompt}. Realistyczne zdjęcie, naturalne światło, bez tekstu, bez logo, bez znaków wodnych.`,
        )
      : null;

    await db.transaction(async (tx) => {
      const title = parsed.data.title ?? null;
      await tx.insert(contentRevisions).values({
        contentItemId: item.id,
        title: title && title !== item.title ? item.title : null,
        body: item.body,
        imageUrl: item.imageUrl,
        instruction: parsed.data.instruction,
      });
      await tx
        .update(contentItems)
        .set({
          body: parsed.data.body,
          ...(title ? { title } : {}),
          ...(image ? { imageUrl: image.url, imageKey: image.key } : {}),
          updatedAt: new Date(),
        })
        .where(eq(contentItems.id, item.id));
    });

    revalidateModule();
    return {
      ok: true,
      title: parsed.data.title ?? item.title,
      body: parsed.data.body,
      imageUrl: image?.url ?? item.imageUrl,
    };
  } catch (error) {
    return fail(error);
  }
}

/** Restores the version saved before the last chat change (a DB read, no AI). */
export async function undoContentRevision(
  input: unknown,
): Promise<
  | { ok: true; title: string; body: string; imageUrl: string | null }
  | ActionFail
> {
  const parsed = z.object({ itemId: z.string().uuid() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Niepoprawne dane" };

  try {
    const profile = await getActiveProfile();
    const item = await requirePending(profile, parsed.data.itemId);
    const [last] = await db
      .select()
      .from(contentRevisions)
      .where(eq(contentRevisions.contentItemId, item.id))
      .orderBy(desc(contentRevisions.createdAt))
      .limit(1);
    if (!last) return { ok: false, error: "Nie ma zmiany do cofnięcia" };

    const droppedKey =
      item.imageKey && item.imageUrl !== last.imageUrl ? item.imageKey : null;

    await db.transaction(async (tx) => {
      await tx
        .update(contentItems)
        .set({
          ...(last.title ? { title: last.title } : {}),
          body: last.body,
          imageUrl: last.imageUrl,
          imageKey: last.imageUrl ? publicImageKeyFromUrl(last.imageUrl) : null,
          updatedAt: new Date(),
        })
        .where(eq(contentItems.id, item.id));
      await tx.delete(contentRevisions).where(eq(contentRevisions.id, last.id));
    });

    if (droppedKey) {
      await deletePublicImage(droppedKey).catch((error) =>
        console.error("Image cleanup failed:", error),
      );
    }

    revalidateModule();
    return {
      ok: true,
      title: last.title ?? item.title,
      body: last.body,
      imageUrl: last.imageUrl,
    };
  } catch (error) {
    return fail(error);
  }
}
