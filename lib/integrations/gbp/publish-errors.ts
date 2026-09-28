import {
  GbpNotConnectedError,
  isGbpUnauthenticatedError,
} from "@/lib/integrations/gbp/errors";

const GBP_RECONNECT_MESSAGE =
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
