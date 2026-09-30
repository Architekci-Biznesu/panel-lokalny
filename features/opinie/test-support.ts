import {
  ChannelReviewError,
  type ChannelReview,
  type ChannelReviews,
  type ReviewsPage,
} from "../../lib/integrations/channel";

/**
 * Test doubles for the review jobs: a fake channel (never Google) and helpers.
 * Tests that touch the database need TEST_DATABASE_URL: a local database, or
 * a separate Neon branch (e.g. "test") when TEST_DATABASE_ALLOW_REMOTE=1 and
 * its endpoint differs from DATABASE_URL. The test wipes that database, so
 * anything that could be the app's database is refused.
 */

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

/** Accounts created by the tests - a database with any other account is real. */
export const TEST_EMAIL_DOMAIN = "@test.pl";

/** Neon endpoint of a host: the pooled and the direct address are one database. */
function endpointOf(host: string): string {
  return host.split(".")[0].replace(/-pooler$/, "");
}

/** TEST_DATABASE_URL, or null when unset. Throws when it could be the app's database. */
export function testDatabaseUrl(): string | null {
  const url = process.env.TEST_DATABASE_URL?.trim();
  if (!url) return null;
  const host = new URL(url).hostname;
  if (LOCAL_HOSTS.has(host)) return url;

  if (process.env.TEST_DATABASE_ALLOW_REMOTE !== "1") {
    throw new Error(
      `TEST_DATABASE_URL wskazuje bazę zdalną (${host}) - ustaw TEST_DATABASE_ALLOW_REMOTE=1, jeśli to osobna gałąź testowa`,
    );
  }
  const appUrl = process.env.DATABASE_URL?.trim();
  if (appUrl && endpointOf(new URL(appUrl).hostname) === endpointOf(host)) {
    throw new Error(
      "TEST_DATABASE_URL wskazuje tę samą bazę co DATABASE_URL - test by ją wyczyścił",
    );
  }
  return url;
}

export function fakeReview(
  externalId: string,
  overrides: Partial<ChannelReview> = {},
): ChannelReview {
  const at = overrides.updatedAt ?? overrides.createdAt ?? new Date();
  return {
    externalId,
    rating: 5,
    authorName: "Anna",
    authorPhotoUrl: null,
    comment: "Polecam",
    createdAt: at,
    updatedAt: at,
    reply: null,
    ...overrides,
  };
}

/** In-memory reviews of one location; behaves like Google (a reply lives on the review). */
export class FakeReviews implements ChannelReviews {
  reviews: ChannelReview[] = [];
  pageSize = 2;
  fetchCalls = 0;
  replyAttempts = 0;
  putCalls: Array<{ externalId: string; text: string }> = [];
  deleteCalls: string[] = [];
  failFetch: Error | null = null;
  failReply: Error | null = null;
  replyTime = new Date("2026-09-29T12:00:00Z");

  async fetchReviews(pageToken: string | null): Promise<ReviewsPage> {
    this.fetchCalls++;
    if (this.failFetch) throw this.failFetch;
    const sorted = [...this.reviews].sort(
      (a, b) => (b.updatedAt?.getTime() ?? 0) - (a.updatedAt?.getTime() ?? 0),
    );
    const start = pageToken ? Number(pageToken) : 0;
    return {
      reviews: sorted.slice(start, start + this.pageSize),
      nextPageToken:
        start + this.pageSize < sorted.length
          ? String(start + this.pageSize)
          : null,
      averageRating: 4.5,
      totalCount: sorted.length,
    };
  }

  async replyToReview(externalId: string, text: string) {
    this.replyAttempts++;
    if (this.failReply) throw this.failReply;
    const review = this.reviews.find((item) => item.externalId === externalId);
    if (!review)
      throw new ChannelReviewError("Nie znaleziono tej opinii w Google");
    this.putCalls.push({ externalId, text });
    review.reply = { text, updatedAt: this.replyTime };
    return { repliedAt: this.replyTime };
  }

  async deleteReply(externalId: string) {
    this.deleteCalls.push(externalId);
    const review = this.reviews.find((item) => item.externalId === externalId);
    if (review) review.reply = null;
  }
}
