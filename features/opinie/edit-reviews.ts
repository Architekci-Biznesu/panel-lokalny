import { and, eq, isNotNull } from "drizzle-orm";
import { reviews } from "@/lib/db/schema";
import { checkReplyText } from "@/features/opinie/review-rules";
import { reviewDeps, type ReviewDeps } from "@/features/opinie/review-deps";

type Scope = { reviewId: string; profileId: string };
export type EditResult = { ok: true } | { ok: false; error: string };

const NOT_FOUND: EditResult = { ok: false, error: "Nie znaleziono opinii" };

/**
 * Saves the customer's edit of the draft. Only `draft_text` changes: the
 * published reply stays exactly as it is in Google until "Opublikuj".
 */
export async function saveReviewDraft(
  input: Scope & { text: string },
  deps: ReviewDeps = reviewDeps(),
): Promise<EditResult> {
  const checked = checkReplyText(input.text);
  if (!checked.ok) return checked;

  const updated = await deps.db
    .update(reviews)
    .set({
      draftText: checked.text,
      draftStatus: "ready",
      updatedAt: deps.now(),
    })
    .where(
      and(
        eq(reviews.id, input.reviewId),
        eq(reviews.profileId, input.profileId),
      ),
    )
    .returning({ id: reviews.id });
  return updated.length ? { ok: true } : NOT_FOUND;
}

/** "Odrzuć szkic": clears the draft, the review stays without a reply. */
export async function discardReviewDraft(
  input: Scope,
  deps: ReviewDeps = reviewDeps(),
): Promise<EditResult> {
  const updated = await deps.db
    .update(reviews)
    .set({
      draftText: null,
      draftStatus: "none",
      publishError: null,
      updatedAt: deps.now(),
    })
    .where(
      and(
        eq(reviews.id, input.reviewId),
        eq(reviews.profileId, input.profileId),
      ),
    )
    .returning({ id: reviews.id });
  return updated.length ? { ok: true } : NOT_FOUND;
}

/**
 * "Edytuj" on a published reply: the current reply becomes a draft. The
 * public reply is untouched; publishing the draft replaces it in Google.
 */
export async function startEditingReply(
  input: Scope,
  deps: ReviewDeps = reviewDeps(),
): Promise<EditResult> {
  const [row] = await deps.db
    .select({ replyText: reviews.replyText })
    .from(reviews)
    .where(
      and(
        eq(reviews.id, input.reviewId),
        eq(reviews.profileId, input.profileId),
        isNotNull(reviews.replyText),
      ),
    )
    .limit(1);
  if (!row?.replyText)
    return { ok: false, error: "Ta opinia nie ma odpowiedzi" };

  await deps.db
    .update(reviews)
    .set({
      draftText: row.replyText,
      draftStatus: "ready",
      publishError: null,
      updatedAt: deps.now(),
    })
    .where(
      and(
        eq(reviews.id, input.reviewId),
        eq(reviews.profileId, input.profileId),
      ),
    );
  return { ok: true };
}
