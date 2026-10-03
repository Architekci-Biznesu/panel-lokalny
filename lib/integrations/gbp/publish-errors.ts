import type { PublishRetry } from "@/lib/integrations/channel";
import {
  GBP_V4_NOT_FOUND_MESSAGE,
  GbpHttpError,
  GbpNotConnectedError,
  GbpUnknownOutcomeError,
  isGbpUnauthenticatedError,
} from "@/lib/integrations/gbp/errors";

export const GBP_RECONNECT_MESSAGE =
  "Autoryzacja Google wygasła - połącz ponownie wizytówkę w Ustawienia > Integracje";

/** Short, readable reason from a Google error body (never the raw HTTP dump). */
export function gbpPublishErrorMessage(error: unknown): string {
  if (error instanceof GbpNotConnectedError) {
    return error.message.includes("wygasła")
      ? GBP_RECONNECT_MESSAGE
      : "Profil nie ma podłączonej wizytówki Google";
  }
  if (isGbpUnauthenticatedError(error)) return GBP_RECONNECT_MESSAGE;

  const raw = error instanceof Error ? error.message : "";
  if (raw.includes("nie należy do żadnego konta")) {
    return "Wizytówka nie jest dostępna z tego konta Google - połącz ją ponownie";
  }
  const json = raw.slice(raw.indexOf("{"));
  try {
    const parsed = JSON.parse(json) as {
      error?: { message?: string; status?: string };
    };
    if (parsed.error?.status === "PERMISSION_DENIED") {
      return "Brak uprawnień do publikacji na tej wizytówce";
    }
    if (parsed.error?.message) {
      return `Google odrzucił post: ${parsed.error.message}`;
    }
  } catch {
    // not JSON - fall through
  }
  return "Nie udało się opublikować posta w Google";
}

/** Transient HTTP answers - Google did not create the post, a retry may work. */
function isTransientStatus(status: number): boolean {
  return status >= 500 || status === 429 || status === 408;
}

function statusOf(error: unknown): number | null {
  if (error instanceof GbpHttpError) return error.status;
  const match = /failed \((\d{3})\)/.exec(
    error instanceof Error ? error.message : "",
  );
  return match ? Number(match[1]) : null;
}

/**
 * Whether publishing a post may be retried after this error. Only answers
 * that prove Google created nothing and may answer differently next time
 * (5xx, 429, 408) are retried. Other 4xx and expired authorization fail at
 * once - another try gives the same answer. No answer after sending the post
 * is unknown: the post may exist, a retry could create a duplicate.
 */
export function classifyGbpPublishError(error: unknown): PublishRetry {
  if (error instanceof GbpUnknownOutcomeError) return "unknown";
  if (error instanceof GbpNotConnectedError) return "final";
  if (isGbpUnauthenticatedError(error)) return "final";
  const status = statusOf(error);
  if (status !== null) return isTransientStatus(status) ? "retry" : "final";
  const message = error instanceof Error ? error.message : "";
  if (message.includes(GBP_V4_NOT_FOUND_MESSAGE)) return "final";
  // Anything else happened before the post was sent (token refresh, finding
  // the v4 name - a broken connection there created nothing).
  return "retry";
}
