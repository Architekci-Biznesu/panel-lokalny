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
