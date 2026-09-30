/**
 * Turns raw provider/network errors into short Polish messages for the UI.
 * Pure (no server imports) so client components can use it on stored scan errors too.
 */
export function friendlyProviderError(raw: string): string {
  const text = raw.trim();
  const status = Number(/\((\d{3})\)/.exec(text)?.[1]);

  if (
    status === 401 ||
    status === 403 ||
    /brak scrapingdog_api_key/i.test(text)
  ) {
    return "Problem z dostępem do usługi danych map. Skontaktuj się z nami.";
  }
  if (status === 402 || status === 429) {
    return "Limit zapytań do usługi danych map został chwilowo wyczerpany. Spróbuj ponownie później.";
  }
  if (status >= 500 || /bad gateway|service unavailable|timeout/i.test(text)) {
    return "Usługa danych map jest chwilowo niedostępna. Spróbuj ponownie za kilka minut.";
  }
  if (status === 400) {
    return "Usługa danych map nie zwróciła wyników dla tego zapytania. Spróbuj ponownie później.";
  }
  if (/scrapingdog|cloudflare|\{"/i.test(text)) {
    return "Nie udało się pobrać danych z usługi map. Spróbuj ponownie później.";
  }
  return text;
}
