"use server";

import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { getImageProvider, getTextProvider } from "@/lib/ai";
import { defaultImagePrompt, GBP_POST_MAX } from "@/lib/ai/content-prompts";
import { appendBriefAvoid } from "@/lib/brief";
import { db } from "@/lib/db";
import {
  contentChannelEnum,
  contentItems,
  contentRevisions,
  contentTargets,
  type ContentItem,
  type ContentTargetStatus,
  type Profile,
} from "@/lib/db/schema";
import { isChannelAvailable } from "@/lib/integrations/publishers";
import {
  deletePublicImage,
  publicImageKeyFromUrl,
  putPublicImage,
  StorageNotConfiguredError,
} from "@/lib/storage";
import {
  AuthError,
  getActiveProfile,
  listAccountProfileOptions,
  requireOwnedProfile,
} from "@/lib/session";
import { loadContentContext } from "@/features/publikacje/content-context";
import { resolveGroupTargets } from "@/features/publikacje/group-targets";
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

/** Item of the active profile, or an AuthError-like failure. */
async function getOwnedItem(
  profile: Profile,
  itemId: string,
): Promise<ContentItem> {
  const [item] = await db
    .select()
    .from(contentItems)
    .where(
      and(eq(contentItems.id, itemId), eq(contentItems.profileId, profile.id)),
    )
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

/** Generates an image, stores it publicly and returns its url + key. */
async function createPostImage(
  profile: Profile,
  prompt: string,
): Promise<{ url: string; key: string }> {
  const image = await getImageProvider().generateImage({
    prompt,
    size: "1536x1024",
  });
  return putPublicImage(Buffer.from(image.base64, "base64"), image.mimeType, {
    profileId: profile.id,
  });
}

// --- Propozycje ---

const proposalSchema = z.object({
  request: z.string().trim().max(500).optional(),
});

/** AI topic + post for the active profile -> new pending item in the inbox. */
export async function generateContentProposal(
  input: unknown,
): Promise<{ ok: true; itemId: string } | ActionFail> {
  const parsed = proposalSchema.safeParse(input ?? {});
  if (!parsed.success) return { ok: false, error: "Niepoprawne dane" };

  try {
    const profile = await getActiveProfile();
    const context = await loadContentContext(profile);
    const ai = getTextProvider();
    const topic = await ai.generateTopic({
      context,
      channel: "wizytówka Google",
      request: parsed.data.request || null,
    });
    const content = await ai.generateContent({
      context,
      topic,
      channel: "wizytówka Google",
    });

    const [item] = await db
      .insert(contentItems)
      .values({
        profileId: profile.id,
        type: "post",
        status: "pending",
        topic: parsed.data.request || topic,
        title: topic,
        body: content.body,
      })
      .returning({ id: contentItems.id });

    revalidateModule();
    return { ok: true, itemId: item.id };
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
  withImage: z.boolean().default(false),
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

    if (parsed.data.withImage && !item.imageUrl) {
      const context = await loadContentContext(profile);
      const image = await createPostImage(
        profile,
        defaultImagePrompt(context, item.title),
      );
      await db
        .update(contentItems)
        .set({ imageUrl: image.url, imageKey: image.key })
        .where(eq(contentItems.id, item.id));
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
      profile,
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

const reviseSchema = z.object({
  itemId: z.string().uuid(),
  instruction: z.string().trim().min(2).max(1000),
});

/** AI rewrite preview - nothing is saved until applyContentRevision. */
export async function previewContentRevision(input: unknown): Promise<
  | {
      ok: true;
      body: string;
      /** AI decided the customer asked for a new image */
      newImagePrompt: string | null;
    }
  | ActionFail
> {
  const parsed = reviseSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Napisz, co zmienić w treści" };
  }

  try {
    const profile = await getActiveProfile();
    const item = await requirePending(profile, parsed.data.itemId);
    const context = await loadContentContext(profile);
    const content = await getTextProvider().generateContent({
      context,
      topic: item.topic,
      channel: "wizytówka Google",
      revision: {
        previousBody: item.body,
        instruction: parsed.data.instruction,
      },
    });
    return {
      ok: true,
      body: content.body,
      newImagePrompt: content.newImagePrompt,
    };
  } catch (error) {
    return fail(error);
  }
}

const applySchema = reviseSchema.extend({
  body: z.string().trim().min(1).max(GBP_POST_MAX),
  newImagePrompt: z.string().trim().max(1000).nullable().optional(),
});

/** Saves the previewed version; the previous one goes to content_revisions. */
export async function applyContentRevision(
  input: unknown,
): Promise<{ ok: true; body: string; imageUrl: string | null } | ActionFail> {
  const parsed = applySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Niepoprawne dane" };

  try {
    const profile = await getActiveProfile();
    const item = await requirePending(profile, parsed.data.itemId);

    const image = parsed.data.newImagePrompt
      ? await createPostImage(profile, parsed.data.newImagePrompt)
      : null;

    await db.transaction(async (tx) => {
      await tx.insert(contentRevisions).values({
        contentItemId: item.id,
        body: item.body,
        imageUrl: item.imageUrl,
        instruction: parsed.data.instruction,
      });
      await tx
        .update(contentItems)
        .set({
          body: parsed.data.body,
          ...(image ? { imageUrl: image.url, imageKey: image.key } : {}),
          updatedAt: new Date(),
        })
        .where(eq(contentItems.id, item.id));
    });

    revalidateModule();
    return {
      ok: true,
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
): Promise<{ ok: true; body: string; imageUrl: string | null } | ActionFail> {
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
    return { ok: true, body: last.body, imageUrl: last.imageUrl };
  } catch (error) {
    return fail(error);
  }
}
