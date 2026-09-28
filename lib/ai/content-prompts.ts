import type {
  ContentContext,
  GenerateContentInput,
  GenerateTopicInput,
} from "@/lib/ai/types";

/** Google Business Profile post summary limit. */
export const GBP_POST_MAX = 1500;

function lines(value: string | null | undefined): string[] {
  return (value ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

/** Shared profile block - identical for topics and posts. */
export function contentContextBlock(context: ContentContext): string {
  const bans = [...lines(context.avoid), ...lines(context.outOfScope)];
  return [
    `Firma: ${context.businessName}`,
    `Usługi (brief): ${context.brief.services}`,
    `Ton: ${context.brief.tone}`,
    `Grupa docelowa: ${context.brief.targetAudience}`,
    `Wyróżniki: ${context.brief.differentiators}`,
    context.serviceArea ? `Obszar działania: ${context.serviceArea}` : null,
    context.categories.length
      ? `Kategorie w Google: ${context.categories.join(", ")}`
      : null,
    context.services.length
      ? `Usługi w wizytówce Google: ${context.services.join(", ")}`
      : null,
    "",
    bans.length
      ? [
          "ZAKAZY - twarde, nigdy ich nie łam (ani w temacie, ani w treści):",
          ...bans.map((ban) => `- ${ban}`),
        ].join("\n")
      : "ZAKAZY: brak.",
    "",
    context.recentTitles.length
      ? [
          "Ostatnie publikacje - NIE powtarzaj tych tematów ani ich przeformułowań:",
          ...context.recentTitles.map((title) => `- ${title}`),
        ].join("\n")
      : "Ostatnie publikacje: brak.",
  ]
    .filter((line) => line !== null)
    .join("\n");
}

export const TOPIC_SYSTEM_PROMPT = `Proponujesz jeden temat posta do wizytówki Google lokalnej firmy w Polsce.
Temat ma wynikać z usług i wyróżników firmy, być konkretny i przydatny dla klienta.
Przestrzegaj ZAKAZÓW z kontekstu. Nie powtarzaj tematów z listy ostatnich publikacji.
Jeśli klient podał prośbę, trzymaj się jej, ale nadal w granicach ZAKAZÓW.
Odpowiedz samym tematem po polsku, jedno zdanie, bez cudzysłowów i bez kropki na końcu.`;

export function topicUserPrompt(input: GenerateTopicInput): string {
  return [
    contentContextBlock(input.context),
    "",
    `Kanał: ${input.channel ?? "wizytówka Google"}`,
    input.request?.trim()
      ? `Prośba klienta - o czym ma być publikacja: ${input.request.trim()}`
      : null,
  ]
    .filter((line) => line !== null)
    .join("\n");
}

export const CONTENT_SYSTEM_PROMPT = `Piszesz post do wizytówki Google lokalnej firmy w Polsce.
Zwróć WYŁĄCZNIE JSON: { "body": string, "newImagePrompt": string | null }.
- body: gotowa treść posta po polsku, maks. ${GBP_POST_MAX} znaków (celuj w 600-1000), bez emotikon, bez hashtagów, bez markdownu. Opieraj się na konkretnych usługach i wyróżnikach, unikaj pustych fraz. Nie zmyślaj cen, dat, promocji ani faktów spoza kontekstu.
- Przestrzegaj ZAKAZÓW z kontekstu - to twarde reguły.
- newImagePrompt: przy pierwszej wersji zawsze null. Przy poprawce: null, chyba że klient w instrukcji prosi o nową / inną grafikę lub zdjęcie - wtedy krótki opis grafiki po angielsku (fotografia, bez tekstu na obrazie).
- Przy poprawce zmieniaj tylko to, o co prosi instrukcja; resztę treści zachowaj.`;

export function contentUserPrompt(input: GenerateContentInput): string {
  return [
    contentContextBlock(input.context),
    "",
    `Kanał: ${input.channel ?? "wizytówka Google"}`,
    `Temat: ${input.topic}`,
    input.revision
      ? [
          "",
          "Obecna treść posta:",
          input.revision.previousBody,
          "",
          `Instrukcja klienta - co zmienić: ${input.revision.instruction}`,
        ].join("\n")
      : null,
  ]
    .filter((line) => line !== null)
    .join("\n");
}

/** Image prompt for a post when the customer did not describe one. */
export function defaultImagePrompt(
  context: ContentContext,
  title: string,
): string {
  const services = context.services.length
    ? context.services.slice(0, 5).join(", ")
    : context.brief.services;
  return [
    `Realistic photo for a local business post: ${title}.`,
    `Business: ${context.businessName}. Services: ${services}.`,
    "Natural light, authentic setting, no text, no logos, no watermarks.",
  ].join(" ");
}
