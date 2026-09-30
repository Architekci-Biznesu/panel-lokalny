/** Fields of the company context form - shared by the form and its loading skeleton. */
export const KONTEKST_FIELDS = [
  ["services", "Usługi", "textarea"],
  ["tone", "Ton komunikacji", "textarea"],
  ["targetAudience", "Grupa docelowa", "textarea"],
  ["differentiators", "Wyróżniki", "textarea"],
  ["serviceArea", "Obszar działania", "textarea"],
  ["avoid", "Czego unikać w komunikacji", "textarea"],
  ["outOfScope", "Czego nie robimy", "textarea"],
  ["websiteUrl", "Adres strony", "input"],
  ["notes", "Uwagi własne", "textarea"],
] as const;

export const KONTEKST_INTRO =
  "Brief steruje propozycjami AI w wizytówce i kolejnych modułach.";
