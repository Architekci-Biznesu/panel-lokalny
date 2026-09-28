import { after } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { getImageProvider, getTextProvider } from "@/lib/ai";
import { db } from "@/lib/db";
import {
  contentGenerationRuns,
  contentItems,
  contentTopics,
  profiles,
  type ContentGenerationRun,
  type Profile,
} from "@/lib/db/schema";
import { putPublicImage } from "@/lib/storage";
import { loadContentContext } from "@/features/publikacje/content-context";
import {
  MAX_POSTS_PER_REQUEST,
  MAX_TOPICS_TO_WRITE,
  TOPICS_BATCH,
  planOnboardingGeneration,
  withRunTitles,
  type OnboardingProfile,
} from "@/features/publikacje/generation-rules";
import { topicsInScope, type ContentScope } from "@/features/publikacje/scope";

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
 * Starts a background run. Caller must have verified the profile, its scope
 * and (for `topicIds`) that the topics belong to it. Returns the run id.
 * - kind "topics": AI proposes `count` topics to choose from
 * - kind "posts" + topicIds: one post per chosen topic
 * - kind "posts" without topicIds: AI picks topics itself (chat request)
 */
export async function enqueueContentGeneration(input: {
  profile: Profile;
  scope: ContentScope;
  kind?: "posts" | "topics";
  count?: number;
  topicIds?: string[];
  request?: string | null;
}): Promise<string> {
  const kind = input.kind ?? "posts";
  const count =
    kind === "topics"
      ? Math.min(MAX_TOPICS_TO_WRITE, Math.max(1, input.count ?? TOPICS_BATCH))
      : input.topicIds?.length
        ? Math.min(MAX_TOPICS_TO_WRITE, input.topicIds.length)
        : Math.min(MAX_POSTS_PER_REQUEST, Math.max(1, input.count ?? 1));

  const [run] = await db
    .insert(contentGenerationRuns)
    .values({
      profileId: input.profile.id,
      groupId: input.scope.groupId,
      kind,
      status: "running",
      requested: count,
      topicIds: input.topicIds?.slice(0, count) ?? null,
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

async function markCreated(runId: string, created: number) {
  await db
    .update(contentGenerationRuns)
    .set({ created })
    .where(eq(contentGenerationRuns.id, runId));
}

/** AI topics for the customer to choose from (never repeats posts or open topics). */
async function runTopics(run: ContentGenerationRun, profile: Profile) {
  const context = await loadContentContext(profile);
  const waiting = await db
    .select({ title: contentTopics.title })
    .from(contentTopics)
    .where(
      and(
        topicsInScope({ profileId: profile.id, groupId: run.groupId }),
        eq(contentTopics.status, "open"),
      ),
    );
  const topics = await getTextProvider().generateTopics({
    context,
    count: run.requested,
    exclude: [...context.recentTitles, ...waiting.map((t) => t.title)],
  });
  if (topics.length) {
    await db.insert(contentTopics).values(
      topics.map((title) => ({
        profileId: profile.id,
        groupId: run.groupId,
        title,
        origin: "ai" as const,
      })),
    );
  }
  await markCreated(run.id, topics.length);
}

/** Posts: from chosen topics, or on topics AI picks (chat request). */
async function runPosts(run: ContentGenerationRun, profile: Profile) {
  const context = await loadContentContext(profile);
  const ai = getTextProvider();
  const runTitles: string[] = [];

  const chosen = run.topicIds?.length
    ? await db
        .select()
        .from(contentTopics)
        .where(
          and(
            inArray(contentTopics.id, run.topicIds),
            topicsInScope({ profileId: profile.id, groupId: run.groupId }),
            eq(contentTopics.status, "open"),
          ),
        )
    : null;
  const total = chosen ? chosen.length : run.requested;

  for (let index = 0; index < total; index++) {
    const postContext = {
      ...context,
      recentTitles: withRunTitles(context.recentTitles, runTitles),
    };
    const chosenTopic = chosen?.[index] ?? null;
    const topic =
      chosenTopic?.title ??
      (await ai.generateTopic({
        context: postContext,
        channel: CHANNEL_LABEL,
        request: run.request,
      }));
    const content = await ai.generateContent({
      context: postContext,
      topic,
      channel: CHANNEL_LABEL,
    });

    const [item] = await db
      .insert(contentItems)
      .values({
        profileId: profile.id,
        groupId: run.groupId,
        type: "post",
        status: "pending",
        topic: run.request || topic,
        title: topic,
        body: content.body,
      })
      .returning({ id: contentItems.id });

    if (chosenTopic) {
      await db
        .update(contentTopics)
        .set({ status: "used", contentItemId: item.id, usedAt: new Date() })
        .where(eq(contentTopics.id, chosenTopic.id));
    }
    runTitles.push(topic);
    await markCreated(run.id, index + 1);
  }
}

/**
 * Runs a background batch (no session - safe for after() or a worker).
 * The profile is loaded by id; the run was validated when it was queued.
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

    if (run.kind === "topics") await runTopics(run, profile);
    else await runPosts(run, profile);

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
        error:
          run.kind === "topics"
            ? "AI nie zaproponowało tematów - spróbuj ponownie"
            : "AI nie przygotowało wszystkich postów - spróbuj ponownie",
        finishedAt: new Date(),
      })
      .where(eq(contentGenerationRuns.id, run.id));
  }
}

/** Groups (of the given account) that already have posts or topics. */
export async function groupsWithContent(
  groupIds: string[],
): Promise<Set<string>> {
  if (groupIds.length === 0) return new Set();
  const [items, topics] = await Promise.all([
    db
      .selectDistinct({ groupId: contentItems.groupId })
      .from(contentItems)
      .where(inArray(contentItems.groupId, groupIds)),
    db
      .selectDistinct({ groupId: contentTopics.groupId })
      .from(contentTopics)
      .where(inArray(contentTopics.groupId, groupIds)),
  ]);
  return new Set(
    [...items, ...topics]
      .map((row) => row.groupId)
      .filter((id): id is string => Boolean(id)),
  );
}

/**
 * After onboarding: 5 topics to choose from per new publish group and per new
 * ungrouped profile, in the background. Never throws - onboarding must finish
 * even if this fails.
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
        kind: "topics",
        count: TOPICS_BATCH,
      });
    }
  } catch (error) {
    console.error("Onboarding topics were not scheduled:", error);
  }
}
