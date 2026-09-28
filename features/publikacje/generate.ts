import { after } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { getImageProvider, getTextProvider } from "@/lib/ai";
import { defaultImagePrompt } from "@/lib/ai/content-prompts";
import { db } from "@/lib/db";
import {
  contentGenerationRuns,
  contentItems,
  profiles,
  type Profile,
} from "@/lib/db/schema";
import { putPublicImage } from "@/lib/storage";
import { loadContentContext } from "@/features/publikacje/content-context";
import {
  MAX_POSTS_PER_REQUEST,
  ONBOARDING_IMAGES,
  ONBOARDING_POSTS,
  planOnboardingGeneration,
  withRunTitles,
  type OnboardingProfile,
} from "@/features/publikacje/generation-rules";
import type { ContentScope } from "@/features/publikacje/scope";

const CHANNEL_LABEL = "wizytówka Google";

/** Generates an image, stores it publicly and returns its url + key. */
export async function createPostImage(
  profileId: string,
  prompt: string,
): Promise<{ url: string; key: string }> {
  const image = await getImageProvider().generateImage({
    prompt,
    size: "1536x1024",
  });
  return putPublicImage(Buffer.from(image.base64, "base64"), image.mimeType, {
    profileId,
  });
}

/**
 * Starts a background batch of proposals. Caller must have verified the
 * profile and its scope (active account). Returns the run id for polling.
 */
export async function enqueueContentGeneration(input: {
  profile: Profile;
  scope: ContentScope;
  count: number;
  imageCount?: number;
  request?: string | null;
}): Promise<string> {
  const count = Math.min(MAX_POSTS_PER_REQUEST, Math.max(1, input.count));
  const [run] = await db
    .insert(contentGenerationRuns)
    .values({
      profileId: input.profile.id,
      groupId: input.scope.groupId,
      status: "running",
      requested: count,
      withImage: Math.min(count, Math.max(0, input.imageCount ?? 0)),
      request: input.request?.trim() || null,
    })
    .returning({ id: contentGenerationRuns.id });

  const runId = run.id;
  // TODO: przenieść do kolejki BullMQ (Faza 5)
  after(() => {
    void runContentGeneration(runId);
  });
  return runId;
}

/**
 * Writes the run's posts one by one (no session - safe for after() or a
 * worker). An image failure keeps the post without an image.
 */
export async function runContentGeneration(runId: string): Promise<void> {
  const [run] = await db
    .select()
    .from(contentGenerationRuns)
    .where(eq(contentGenerationRuns.id, runId))
    .limit(1);
  if (!run || run.status !== "running") return;

  try {
    const [profile] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.id, run.profileId))
      .limit(1);
    if (!profile) throw new Error("Profil nie istnieje");

    const context = await loadContentContext(profile);
    const ai = getTextProvider();
    const runTitles: string[] = [];

    for (let index = 0; index < run.requested; index++) {
      const postContext = {
        ...context,
        recentTitles: withRunTitles(context.recentTitles, runTitles),
      };
      const topic = await ai.generateTopic({
        context: postContext,
        channel: CHANNEL_LABEL,
        request: run.request,
      });
      const content = await ai.generateContent({
        context: postContext,
        topic,
        channel: CHANNEL_LABEL,
      });

      let image: { url: string; key: string } | null = null;
      if (index < run.withImage) {
        try {
          image = await createPostImage(
            profile.id,
            defaultImagePrompt(context, topic),
          );
        } catch (error) {
          console.error("Proposal image failed:", error);
        }
      }

      await db.insert(contentItems).values({
        profileId: profile.id,
        groupId: run.groupId,
        type: "post",
        status: "pending",
        topic: run.request || topic,
        title: topic,
        body: content.body,
        imageUrl: image?.url ?? null,
        imageKey: image?.key ?? null,
      });
      runTitles.push(topic);
      await db
        .update(contentGenerationRuns)
        .set({ created: index + 1 })
        .where(eq(contentGenerationRuns.id, run.id));
    }

    await db
      .update(contentGenerationRuns)
      .set({ status: "done", finishedAt: new Date() })
      .where(eq(contentGenerationRuns.id, run.id));
  } catch (error) {
    console.error("Content generation failed:", error);
    await db
      .update(contentGenerationRuns)
      .set({
        status: "failed",
        error: "AI nie przygotowało wszystkich propozycji - spróbuj ponownie",
        finishedAt: new Date(),
      })
      .where(eq(contentGenerationRuns.id, run.id));
  }
}

/** Groups (of the given account) that already have at least one post. */
export async function groupsWithContent(
  groupIds: string[],
): Promise<Set<string>> {
  if (groupIds.length === 0) return new Set();
  const rows = await db
    .selectDistinct({ groupId: contentItems.groupId })
    .from(contentItems)
    .where(inArray(contentItems.groupId, groupIds));
  return new Set(
    rows.map((row) => row.groupId).filter((id): id is string => Boolean(id)),
  );
}

/**
 * After onboarding: 3 proposals (1 with an image) per new publish group and
 * per new ungrouped profile, in the background. Never throws - onboarding
 * must finish even if this fails.
 */
export async function scheduleOnboardingProposals(
  accountId: string,
  created: OnboardingProfile[],
): Promise<void> {
  try {
    if (created.length === 0) return;
    const rows = await db
      .select()
      .from(profiles)
      .where(
        and(
          inArray(
            profiles.id,
            created.map((p) => p.profileId),
          ),
          eq(profiles.accountId, accountId),
        ),
      );
    const byId = new Map(rows.map((row) => [row.id, row]));
    const groupIds = [
      ...new Set(
        created.map((p) => p.groupId).filter((id): id is string => Boolean(id)),
      ),
    ];
    const plan = planOnboardingGeneration(
      created.filter((p) => byId.has(p.profileId)),
      await groupsWithContent(groupIds),
    );
    for (const entry of plan) {
      await enqueueContentGeneration({
        profile: byId.get(entry.profileId)!,
        scope: { profileId: entry.profileId, groupId: entry.groupId },
        count: ONBOARDING_POSTS,
        imageCount: ONBOARDING_IMAGES,
      });
    }
  } catch (error) {
    console.error("Onboarding proposals were not scheduled:", error);
  }
}
