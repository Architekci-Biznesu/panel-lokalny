import { gbpFetch } from "@/lib/integrations/gbp/fetch";
import type { Profile } from "@/lib/db/schema";
import {
  ChannelReviewError,
  type ChannelReview,
  type ChannelReviews,
  type ReviewsPage,
} from "@/lib/integrations/channel";
import {
  GbpHttpError,
  GbpNotConnectedError,
  isGbpUnauthenticatedError,
} from "@/lib/integrations/gbp/errors";
import { gbpReviewErrorMessage } from "@/lib/integrations/gbp/review-errors";
import { getGbpAccessTokenForProfile } from "@/lib/integrations/gbp/token";
import { starRatingToNumber } from "@/lib/integrations/gbp/star-rating";
import { withGbpV4LocationName } from "@/lib/integrations/gbp/v4-name";

/**
 * Reviews live on the old v4 API (accounts/{a}/locations/{l}/reviews), like
 * posts. No session and no next/* here - the sync runs as a background job.
 */

const REVIEWS_PAGE_SIZE = 50;

type GbpReviewRaw = {
  reviewId?: string;
  name?: string;
  reviewer?: {
    displayName?: string;
    profilePhotoUrl?: string;
    isAnonymous?: boolean;
  };
  starRating?: string;
  comment?: string;
  createTime?: string;
  updateTime?: string;
  reviewReply?: { comment?: string; updateTime?: string };
};

type GbpReviewsResponse = {
  reviews?: GbpReviewRaw[];
  averageRating?: number;
  totalReviewCount?: number;
  nextPageToken?: string;
};

function parseTime(value: string | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** `name` is `accounts/../locations/../reviews/{id}` - reviewId is the same id. */
function reviewIdOf(raw: GbpReviewRaw): string | null {
  return raw.reviewId ?? raw.name?.split("/").pop() ?? null;
}

/** One Google review -> plain values. Stars-only reviews have no comment. */
export function parseGbpReview(raw: GbpReviewRaw): ChannelReview | null {
  const externalId = reviewIdOf(raw);
  if (!externalId) return null;

  const comment = raw.comment?.trim() || null;
  const replyText = raw.reviewReply?.comment?.trim();
  return {
    externalId,
    rating: starRatingToNumber(raw.starRating),
    authorName: raw.reviewer?.displayName?.trim() ?? "",
    authorPhotoUrl: raw.reviewer?.profilePhotoUrl ?? null,
    comment,
    createdAt: parseTime(raw.createTime),
    updatedAt: parseTime(raw.updateTime),
    reply: replyText
      ? { text: replyText, updatedAt: parseTime(raw.reviewReply?.updateTime) }
      : null,
  };
}

export function parseGbpReviewsPage(data: GbpReviewsResponse): ReviewsPage {
  const reviews: ChannelReview[] = [];
  for (const raw of data.reviews ?? []) {
    const parsed = parseGbpReview(raw);
    if (parsed) reviews.push(parsed);
  }
  return {
    reviews,
    nextPageToken: data.nextPageToken ?? null,
    averageRating:
      typeof data.averageRating === "number" ? data.averageRating : null,
    totalCount:
      typeof data.totalReviewCount === "number" ? data.totalReviewCount : null,
  };
}

async function readError(label: string, response: Response): Promise<Error> {
  return new GbpHttpError(label, response.status, await response.text());
}

/** Reviews of one profile's Google location. */
export function createGbpReviews(profile: Profile): ChannelReviews {
  /** Token with one forced refresh when Google says it is stale. */
  async function withToken<T>(run: (token: string) => Promise<T>): Promise<T> {
    if (!profile.gbpLocationId || !profile.oauthConnectionId) {
      throw new GbpNotConnectedError();
    }
    let token = await getGbpAccessTokenForProfile(profile);
    try {
      return await run(token);
    } catch (error) {
      if (!isGbpUnauthenticatedError(error)) throw error;
      token = await getGbpAccessTokenForProfile(profile, { force: true });
      return run(token);
    }
  }

  /** Token plus the v4 location name stored in the profile. */
  async function call<T>(
    run: (token: string, parent: string) => Promise<T>,
  ): Promise<T> {
    try {
      return await withToken((token) =>
        withGbpV4LocationName(profile, token, (parent) => run(token, parent)),
      );
    } catch (error) {
      throw new ChannelReviewError(gbpReviewErrorMessage(error));
    }
  }

  return {
    fetchReviews(pageToken) {
      return call(async (token, parent) => {
        const url = new URL(
          `https://mybusiness.googleapis.com/v4/${parent}/reviews`,
        );
        url.searchParams.set("pageSize", String(REVIEWS_PAGE_SIZE));
        url.searchParams.set("orderBy", "updateTime desc");
        if (pageToken) url.searchParams.set("pageToken", pageToken);

        const response = await gbpFetch(url, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) throw await readError("GBP reviews.list", response);
        return parseGbpReviewsPage(
          (await response.json()) as GbpReviewsResponse,
        );
      });
    },

    replyToReview(externalId, text) {
      return call(async (token, base) => {
        // PUT creates the reply or REPLACES the existing one - repeating this
        // call never leaves two replies (Phase 5 retries rely on that).
        const response = await gbpFetch(
          `https://mybusiness.googleapis.com/v4/${base}/reviews/${encodeURIComponent(externalId)}/reply`,
          {
            method: "PUT",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ comment: text }),
          },
        );
        if (!response.ok) throw await readError("GBP reviews.reply", response);
        const data = (await response.json()) as { updateTime?: string };
        return { repliedAt: parseTime(data.updateTime) };
      });
    },

    deleteReply(externalId) {
      return call(async (token, base) => {
        const response = await gbpFetch(
          `https://mybusiness.googleapis.com/v4/${base}/reviews/${encodeURIComponent(externalId)}/reply`,
          { method: "DELETE", headers: { Authorization: `Bearer ${token}` } },
        );
        // 404 = there is no reply any more - the goal is reached.
        if (!response.ok && response.status !== 404) {
          throw await readError("GBP reviews.deleteReply", response);
        }
      });
    },
  };
}
