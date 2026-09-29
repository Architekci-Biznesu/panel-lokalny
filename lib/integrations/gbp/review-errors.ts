import {
  GbpNotConnectedError,
  isGbpUnauthenticatedError,
} from "@/lib/integrations/gbp/errors";
import { GBP_RECONNECT_MESSAGE } from "@/lib/integrations/gbp/publish-errors";

/** Short, readable reason for the customer (never the raw HTTP dump). */
export function gbpReviewErrorMessage(error: unknown): string {
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
  // Replying is only possible for verified locations.
  if (/verif/i.test(raw)) {
    return "Google pozwala odpowiadać na opinie tylko na zweryfikowanej wizytówce - zweryfikuj ją w Google";
  }
  if (raw.includes("PERMISSION_DENIED")) {
    return "Brak uprawnień do odpowiadania na opinie na tej wizytówce";
  }
  if (raw.includes("RESOURCE_EXHAUSTED") || raw.includes("(429)")) {
    return "Google chwilowo ogranicza zapytania - spróbuj za kilka minut";
  }
  if (raw.includes("NOT_FOUND") || raw.includes("(404)")) {
    return "Nie znaleziono tej opinii w Google - mogła zostać usunięta";
  }
  return "Nie udało się połączyć z opiniami w Google";
}
