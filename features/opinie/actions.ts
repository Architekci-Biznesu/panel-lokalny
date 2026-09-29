"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { profiles } from "@/lib/db/schema";
import { AuthError, getActiveProfile } from "@/lib/session";
import { getActiveGbpProfile } from "@/lib/integrations/gbp/access";
import { GbpNotConnectedError } from "@/lib/integrations/gbp/errors";
import { generateReviewDraft } from "@/features/opinie/draft-reviews";
import {
  discardReviewDraft,
  saveReviewDraft,
  startEditingReply,
} from "@/features/opinie/edit-reviews";
import {
  countGeneratingDrafts,
  countPendingReviews,
} from "@/features/opinie/load-reviews";
import {
  deleteReviewReply,
  publishReviewReply,
} from "@/features/opinie/publish-reply";
import { reviewDeps } from "@/features/opinie/review-deps";
import { loadReplyContext } from "@/features/opinie/reply-context";
import { splitReviewText } from "@/features/opinie/review-rules";
import { beginReviewSync } from "@/features/opinie/start-sync";
import { loadReviewSyncState } from "@/features/opinie/sync-control";

type ActionFail = { ok: false; error: string };
type ActionOk = { ok: true };

function fail(error: unknown): ActionFail {
  if (error instanceof AuthError || error instanceof GbpNotConnectedError) {
    return { ok: false, error: error.message };
  }
  console.error("Opinie action failed:", error);
  return { ok: false, error: "Coś poszło nie tak - spróbuj ponownie" };
}

function revalidate() {
  revalidatePath("/opinie");
  revalidatePath("/pulpit");
}

const reviewIdSchema = z.object({ reviewId: z.uuid() });

/** "Odśwież": checks Google for new reviews now. */
export async function refreshReviews(): Promise<
  { ok: true; started: boolean } | ActionFail
> {
  try {
    const profile = await getActiveGbpProfile();
    const { started } = await beginReviewSync(profile);
    revalidate();
    return { ok: true, started };
  } catch (error) {
    return fail(error);
  }
}

/** Polled by the list while a sync runs or drafts are being written. */
export async function getReviewSyncStatus(): Promise<
  | {
      ok: true;
      running: boolean;
      generating: number;
      pending: number;
      lastError: string | null;
    }
  | ActionFail
> {
  try {
    const profile = await getActiveProfile();
    const [state, generating, pending] = await Promise.all([
      loadReviewSyncState(profile.id),
      countGeneratingDrafts(profile),
      countPendingReviews(profile),
    ]);
    return {
      ok: true,
      running: state.running,
      generating,
      pending,
      lastError: state.lastError,
    };
  } catch (error) {
    return fail(error);
  }
}

/** "Zaproponuj odpowiedź" / "Wygeneruj ponownie" (optionally with an instruction). */
export async function requestReviewDraft(
  input: unknown,
): Promise<{ ok: true; text: string } | ActionFail> {
  const parsed = reviewIdSchema
    .extend({ instruction: z.string().trim().max(300).optional() })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "Nieprawidłowa opinia" };
  try {
    const profile = await getActiveProfile();
    const result = await generateReviewDraft({
      reviewId: parsed.data.reviewId,
      profileId: profile.id,
      oneOffInstruction: parsed.data.instruction || null,
    });
    revalidate();
    return result;
  } catch (error) {
    return fail(error);
  }
}

/** Saves the customer's edit of the draft (the public reply is not touched). */
export async function saveReviewDraftText(
  input: unknown,
): Promise<ActionOk | ActionFail> {
  const parsed = reviewIdSchema
    .extend({ text: z.string().max(20_000) })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "Nieprawidłowa odpowiedź" };
  try {
    const profile = await getActiveProfile();
    const result = await saveReviewDraft({
      reviewId: parsed.data.reviewId,
      profileId: profile.id,
      text: parsed.data.text,
    });
    if (result.ok) revalidate();
    return result;
  } catch (error) {
    return fail(error);
  }
}

export async function discardReviewDraftAction(
  input: unknown,
): Promise<ActionOk | ActionFail> {
  const parsed = reviewIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Nieprawidłowa opinia" };
  try {
    const profile = await getActiveProfile();
    const result = await discardReviewDraft({
      reviewId: parsed.data.reviewId,
      profileId: profile.id,
    });
    if (result.ok) revalidate();
    return result;
  } catch (error) {
    return fail(error);
  }
}

/** "Edytuj" on a published reply: it becomes a draft (Google keeps the old text until "Opublikuj"). */
export async function startEditingReviewReply(
  input: unknown,
): Promise<ActionOk | ActionFail> {
  const parsed = reviewIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Nieprawidłowa opinia" };
  try {
    const profile = await getActiveProfile();
    const result = await startEditingReply({
      reviewId: parsed.data.reviewId,
      profileId: profile.id,
    });
    if (result.ok) revalidate();
    return result;
  } catch (error) {
    return fail(error);
  }
}

/** "Opublikuj": saves the text shown in the editor, then publishes it as the reply. */
export async function publishReviewReplyAction(
  input: unknown,
): Promise<ActionOk | ActionFail> {
  const parsed = reviewIdSchema
    .extend({ text: z.string().max(20_000) })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "Nieprawidłowa odpowiedź" };
  try {
    const profile = await getActiveGbpProfile();
    const saved = await saveReviewDraft({
      reviewId: parsed.data.reviewId,
      profileId: profile.id,
      text: parsed.data.text,
    });
    if (!saved.ok) return saved;
    const result = await publishReviewReply({
      reviewId: parsed.data.reviewId,
      profileId: profile.id,
    });
    revalidate();
    return result;
  } catch (error) {
    return fail(error);
  }
}

export async function deleteReviewReplyAction(
  input: unknown,
): Promise<ActionOk | ActionFail> {
  const parsed = reviewIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Nieprawidłowa opinia" };
  try {
    const profile = await getActiveGbpProfile();
    const result = await deleteReviewReply({
      reviewId: parsed.data.reviewId,
      profileId: profile.id,
    });
    if (result.ok) revalidate();
    return result;
  } catch (error) {
    return fail(error);
  }
}

const settingsSchema = z.object({
  mode: z.enum(["accept", "auto"]),
  signature: z.string().trim().max(120),
  instructions: z.string().trim().max(1500),
});

/**
 * Saves the reply settings. Switching auto mode on stamps `review_auto_since`
 * (reviews from before it are never answered automatically); switching it off clears it.
 */
export async function saveReviewSettings(
  input: unknown,
): Promise<ActionOk | ActionFail> {
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Sprawdź pola - podpis do 120, instrukcje do 1500 znaków",
    };
  }
  try {
    const profile = await getActiveProfile();
    const { mode, signature, instructions } = parsed.data;
    const autoSince =
      mode === "auto" ? (profile.reviewAutoSince ?? new Date()) : null;
    await db
      .update(profiles)
      .set({
        reviewMode: mode,
        reviewAutoSince: autoSince,
        reviewSignature: signature || null,
        reviewReplyInstructions: instructions || null,
      })
      .where(eq(profiles.id, profile.id));
    revalidate();
    revalidatePath("/opinie/ustawienia");
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

const SAMPLE_REVIEWS = [
  {
    rating: 5,
    authorName: "Anna",
    text: "Bardzo polecam, wszystko załatwione szybko i konkretnie. Miła obsługa.",
  },
  {
    rating: 2,
    authorName: "Marek",
    text: "Czekałem dłużej niż zapowiadano i nikt mi nie wytłumaczył, co się dzieje.",
  },
] as const;

/** Sample replies with the settings as typed in the form - nothing is saved or published. */
export async function previewReviewReplies(input: unknown): Promise<
  | {
      ok: true;
      samples: Array<{ rating: number; review: string; reply: string }>;
    }
  | ActionFail
> {
  const parsed = settingsSchema
    .pick({ signature: true, instructions: true })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "Sprawdź pola formularza" };
  try {
    const profile = await getActiveProfile();
    const deps = reviewDeps();
    const context = await loadReplyContext(profile, deps);
    const samples = await Promise.all(
      SAMPLE_REVIEWS.map(async (sample) => {
        const { original } = splitReviewText(sample.text);
        const reply = await deps.generateReply({
          businessName: context.businessName,
          brief: context.brief,
          avoid: context.avoid,
          rating: sample.rating,
          authorName: sample.authorName,
          reviewText: original,
          instructions: parsed.data.instructions || null,
          signature: parsed.data.signature || null,
          phone: context.phone,
        });
        return { rating: sample.rating, review: sample.text, reply };
      }),
    );
    return { ok: true, samples };
  } catch (error) {
    return fail(error);
  }
}
