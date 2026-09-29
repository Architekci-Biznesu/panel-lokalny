/** Pure rules for review replies (no DB, no network - safe for tests and background jobs). */

/** Google rejects replies over 4096 BYTES (Polish letters take 2 each). */
export const REPLY_MAX_BYTES = 4096;

/** Only reviews newer than this get a draft without being asked. */
export const AUTO_DRAFT_WINDOW_DAYS = 30;

/** Opening /opinie starts a sync when the last good one is older than this. */
export const SYNC_FRESH_MS = 15 * 60 * 1000;

/** A `running` sync older than this is treated as failed. */
export const SYNC_STALE_MS = 10 * 60 * 1000;

const TRANSLATED_MARK = "(Translated by Google)";
const ORIGINAL_MARK = "(Original)";

/**
 * Reviews in another language arrive as
 * `(Translated by Google) <translation> (Original) <author's words>`.
 * Stars-only reviews have no text at all. The raw text is what we store;
 * this splits it for display and for the AI prompt.
 */
export function splitReviewText(raw: string | null | undefined): {
  /** What the author actually wrote (null for a stars-only review) */
  original: string | null;
  /** Google's Polish translation, when the review was translated */
  translated: string | null;
} {
  const text = raw?.trim();
  if (!text) return { original: null, translated: null };

  const translatedAt = text.indexOf(TRANSLATED_MARK);
  const originalAt = text.indexOf(ORIGINAL_MARK);
  if (translatedAt === -1 || originalAt === -1 || originalAt < translatedAt) {
    return { original: text, translated: null };
  }

  const translated = text
    .slice(translatedAt + TRANSLATED_MARK.length, originalAt)
    .trim();
  const original = text.slice(originalAt + ORIGINAL_MARK.length).trim();
  return {
    original: original || null,
    translated: translated || null,
  };
}

export function byteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}

/** Trimmed reply, or a message for the customer (checked before anything is sent). */
export function checkReplyText(
  text: string,
): { ok: true; text: string } | { ok: false; error: string } {
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, error: "Odpowiedź nie może być pusta" };
  const bytes = byteLength(trimmed);
  if (bytes > REPLY_MAX_BYTES) {
    return {
      ok: false,
      error: `Odpowiedź jest za długa: ${bytes} z ${REPLY_MAX_BYTES} bajtów (polskie znaki liczą się podwójnie) - skróć o ${bytes - REPLY_MAX_BYTES}`,
    };
  }
  return { ok: true, text: trimmed };
}

export type AutoReplyInput = {
  rating: number | null;
  mode: "accept" | "auto";
  /** When auto mode was switched on; null while off */
  autoSince: Date | null;
  /** When the panel first saw the review */
  firstSeenAt: Date;
  /** When the author wrote it (null when the channel did not say) */
  reviewCreatedAt: Date | null;
  hasReply: boolean;
};

export type AutoReplyDecision =
  | { publish: true }
  | {
      publish: false;
      reason:
        | "low_rating"
        | "unknown_rating"
        | "not_auto"
        | "before_auto"
        | "has_reply";
    };

/**
 * Whether a draft may be published without the customer. The order matters:
 * 1-2 stars and reviews from before auto mode are excluded FIRST, so no later
 * condition can let them through.
 */
export function autoReplyDecision(input: AutoReplyInput): AutoReplyDecision {
  // 1. 1-2 stars: always the customer's decision, whatever the mode.
  if (input.rating !== null && input.rating <= 2) {
    return { publish: false, reason: "low_rating" };
  }
  // No usable rating: we cannot tell it is a good review - a human decides.
  if (input.rating === null)
    return { publish: false, reason: "unknown_rating" };

  if (input.mode !== "auto" || !input.autoSince) {
    return { publish: false, reason: "not_auto" };
  }
  // 2. Reviews from before auto mode was switched on are never answered by it.
  //    "First seen" alone is not enough: switch auto on BEFORE the first import
  //    and every existing review would be "first seen" afterwards. So the
  //    author's own date counts too.
  if (
    input.firstSeenAt.getTime() < input.autoSince.getTime() ||
    (input.reviewCreatedAt !== null &&
      input.reviewCreatedAt.getTime() < input.autoSince.getTime())
  ) {
    return { publish: false, reason: "before_auto" };
  }
  // 3. Already answered: nothing to do.
  if (input.hasReply) return { publish: false, reason: "has_reply" };

  // 4. 3-5 stars (also without text): the draft goes out.
  return { publish: true };
}

/** Unanswered review recent enough to get a draft without being asked. */
export function wantsAutoDraft(
  review: {
    replyText: string | null;
    reviewCreatedAt: Date | null;
    firstSeenAt: Date;
  },
  now: Date,
): boolean {
  if (review.replyText) return false;
  const since = review.reviewCreatedAt ?? review.firstSeenAt;
  return now.getTime() - since.getTime() <= AUTO_DRAFT_WINDOW_DAYS * 86_400_000;
}

/**
 * Google may stamp the review a moment after a reply is saved, so a change
 * only counts when it is clearly later than the reply.
 */
export const CHANGE_TOLERANCE_MS = 60_000;

/** The author edited the review after we (or anyone) replied. */
export function changedAfterReply(review: {
  reviewUpdatedAt: Date | null;
  repliedAt: Date | null;
}): boolean {
  if (!review.reviewUpdatedAt || !review.repliedAt) return false;
  return (
    review.reviewUpdatedAt.getTime() - review.repliedAt.getTime() >
    CHANGE_TOLERANCE_MS
  );
}

/** Whitespace-insensitive, so Google re-flowing our text does not look like an outside edit. */
function sameReplyText(a: string, b: string): boolean {
  const norm = (text: string) => text.replace(/\s+/g, " ").trim();
  return norm(a) === norm(b);
}

export type ReplyState = {
  replyText: string | null;
  replySource: "panel" | "external" | null;
  repliedAt: Date | null;
};

export type ReplyPatch = ReplyState & {
  /** An outside reply just appeared - a draft written for the unanswered review is obsolete */
  clearDraft: boolean;
};

/**
 * What the reply looks like after a sync. Replies added or changed outside
 * the panel (Google app, agency) are imported as `external`; ours stay `panel`
 * while the text is unchanged. `existing` is null for a review we have not seen.
 */
export function reconcileReply(
  existing: ReplyState | null,
  incoming: { text: string; updatedAt: Date | null } | null,
  fallbackTime: Date,
): ReplyPatch {
  const current: ReplyState = existing ?? {
    replyText: null,
    replySource: null,
    repliedAt: null,
  };

  if (!incoming) {
    // The reply is gone in Google (deleted there): mirror it.
    return current.replyText
      ? {
          replyText: null,
          replySource: null,
          repliedAt: null,
          clearDraft: false,
        }
      : { ...current, clearDraft: false };
  }

  if (current.replyText && sameReplyText(current.replyText, incoming.text)) {
    return {
      replyText: current.replyText,
      replySource: current.replySource ?? "external",
      repliedAt: incoming.updatedAt ?? current.repliedAt ?? fallbackTime,
      clearDraft: false,
    };
  }

  return {
    replyText: incoming.text,
    replySource: "external",
    repliedAt: incoming.updatedAt ?? fallbackTime,
    clearDraft: !current.replyText,
  };
}

export type RatingFilter = "all" | "low" | "mid" | "high";

export function ratingInFilter(
  rating: number | null,
  filter: RatingFilter,
): boolean {
  if (filter === "all") return true;
  if (rating === null) return false;
  if (filter === "low") return rating <= 2;
  if (filter === "mid") return rating === 3;
  return rating >= 4;
}
