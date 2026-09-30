/** GBP error types without DB/session imports (safe for background jobs and tests). */

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
