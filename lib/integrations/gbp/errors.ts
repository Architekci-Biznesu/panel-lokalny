/** GBP error types without DB/session imports (safe for background jobs and tests). */

/** No account of the connection owns the location (v4 name lookup). */
export const GBP_V4_NOT_FOUND_MESSAGE =
  "lokalizacja nie należy do żadnego konta tego połączenia";

export class GbpNotConnectedError extends Error {
  constructor(message = "Profil nie ma podłączonej wizytówki Google") {
    super(message);
    this.name = "GbpNotConnectedError";
  }
}

export function isGbpUnauthenticatedError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : "";
  return message.includes("UNAUTHENTICATED") || message.includes('"code": 401');
}

/** Google answered with an HTTP error - keeps the status for callers that react to it. */
export class GbpHttpError extends Error {
  constructor(
    label: string,
    readonly status: number,
    body: string,
  ) {
    super(`${label} failed (${status}): ${body}`);
    this.name = "GbpHttpError";
  }
}

/** Google does not know this resource under this name (e.g. the location moved to another account). */
export function isGbpNotFoundError(error: unknown): boolean {
  if (error instanceof GbpHttpError) return error.status === 404;
  const message = error instanceof Error ? error.message : "";
  return message.includes("(404)") || message.includes('"code": 404');
}

/**
 * The request that creates something in Google (a post) was sent, but no
 * answer came back (timeout, broken connection). It may exist in Google -
 * never retried automatically, Google has no idempotency key for posts.
 */
export class GbpUnknownOutcomeError extends Error {
  constructor(label: string, cause: unknown) {
    super(
      `${label}: brak odpowiedzi Google (${cause instanceof Error ? cause.message : "nieznany błąd"})`,
    );
    this.name = "GbpUnknownOutcomeError";
  }
}
