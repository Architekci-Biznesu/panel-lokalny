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
Zwróć WYŁĄCZNIE JSON: { "changes": string[], "title": string | null, "body": string | null, "newImagePrompt": string | null }.
Pierwsza wersja posta (bez instrukcji klienta):
- changes: ["body"], title: null, newImagePrompt: null.
- body: gotowa treść posta po polsku, maks. ${GBP_POST_MAX} znaków (celuj w 600-1000), bez emotikon, bez hashtagów, bez markdownu. Opieraj się na konkretnych usługach i wyróżnikach, unikaj pustych fraz. Nie zmyślaj cen, dat, promocji ani faktów spoza kontekstu.
Poprawka (jest instrukcja klienta):
- changes: TYLKO części, których dotyczy instrukcja: "title" (tytuł), "body" (treść), "image" (grafika / zdjęcie). "Zmień tytuł" = ["title"]. "Skróć" = ["body"]. "Inne zdjęcie" = ["image"]. "Opis", "tekst", "treść", "wpis" to body, nie tytuł - "zmień opis na X" = ["body"].
- title: nowy tytuł, gdy changes zawiera "title" (jedno zdanie, bez kropki, maks. 120 znaków), inaczej null.
- body: nowa treść, gdy changes zawiera "body" (zasady jak wyżej; zmieniaj tylko to, o co prosi instrukcja), inaczej null.
- "image" TYLKO gdy klient wprost prosi o nową / inną grafikę lub zdjęcie. Temat posta (np. post o zdjęciach) albo słowa z tytułu to nie jest prośba o grafikę.
- newImagePrompt: gdy changes zawiera "image" - ZAWSZE opis po polsku, 1-2 zdania, konkretnie co jest na zdjęciu (scena, obiekty, miejsce, nastrój), pasujący do posta i firmy; inaczej null. Grafika powstaje dopiero, gdy klient zatwierdzi propozycję - opis JEST tą propozycją, także gdy klient prosi "najpierw zaproponuj, co ma być na zdjęciu".
Zawsze przestrzegaj ZAKAZÓW z kontekstu - to twarde reguły.`;

export function contentUserPrompt(input: GenerateContentInput): string {
  return [
    contentContextBlock(input.context),
    "",
    `Kanał: ${input.channel ?? "wizytówka Google"}`,
    `Temat: ${input.topic}`,
    input.revision
      ? [
          "",
          input.revision.history?.length
            ? [
                "Wcześniejsze prośby klienta dotyczące tego posta (od najstarszej) - obecna wersja już je uwzględnia, nowa instrukcja może się do nich odwoływać:",
                ...input.revision.history.map((request) => `- ${request}`),
                "",
              ].join("\n")
            : "",
          `Obecny tytuł: ${input.revision.previousTitle}`,
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

export const CHAT_ROUTER_SYSTEM_PROMPT = `Jesteś asystentem w panelu publikacji lokalnej firmy. Klient pisze w czacie obok listy propozycji postów.
Rozpoznaj, czego chce, i zwróć WYŁĄCZNIE JSON jednego z typów:
- { "kind": "edit", "postId": string, "instruction": string } - klient chce zmienić ISTNIEJĄCY post z listy (tytuł, treść, ton, długość, grafikę/zdjęcie). postId MUSI być id z listy. instruction to prośba klienta przepisana wiernie, jego słowami, bez dopisywania własnych wymagań. Jeśli klient podał gotowy nowy tytuł albo tekst, przepisz go w instruction dokładnie, znak w znak (np. klient: "zmień tytuł na Test: Opony zimowe" -> instruction: "zmień tytuł na Test: Opony zimowe").
- { "kind": "create", "count": number, "request": string } - klient chce NOWYCH postów. count 1-3 (domyślnie 1). request to temat / wskazówka dla nowych postów.
- { "kind": "clarify", "question": string } - prośba dotyczy istniejącego posta, ale nie da się jednoznacznie ustalić którego. question to krótkie pytanie po polsku.
- { "kind": "reply", "text": string } - pytanie, prośba o pomysły / radę / opinię, rozmowa ("o czym warto pisać?", "jakie tematy na jesień?"), bez polecenia napisania postów. text to konkretna odpowiedź po polsku, na "ty" (bez "Pan/Pani"), maks. ok. 6 zdań, możesz dać 2-3 ponumerowane propozycje, oparta na kontekście firmy; zakończ pytaniem, czy przygotować posty.
Zasady:
- Czasowniki "zmień, popraw, skróć, przepisz, podmień, dodaj do posta, usuń z posta" dotyczą zwykle istniejącego posta - szukaj go po temacie, słowach z tytułu lub treści (klient pisze skrótami i z literówkami).
- Jest tylko jeden post na liście i klient prosi o zmianę bez wskazania którego - to ten post.
- Klient prosi o zmianę bez wskazania posta ("skróć go", "zmień tytuł"), a na liście jest więcej niż jeden post - clarify, nie zgaduj.
- "Napisz, daj, przygotuj, wygeneruj post/posty" bez odniesienia do istniejącego - create. Pytanie albo prośba o pomysły bez takiego polecenia - reply.
- Zgoda na coś, co asystent zaproponował wcześniej ("tak, napisz te dwa", "ok, zrób pierwszy") - create z request opisującym uzgodnione tematy.
- Brak postów na liście - nigdy nie zwracaj edit.
- Tytuł podany w całości ma pierwszeństwo: "post test" to post o tytule "Test", nie "test 123".
- Jeśli wiadomość to odpowiedź na pytanie asystenta (np. samo "test" po pytaniu "którego posta?"), połącz ją z wcześniejszą prośbą klienta: instruction to ta WCZEŚNIEJSZA prośba (np. "zaproponuj zdjęcie"), a post wskazuje odpowiedź.
- "Zaproponuj zdjęcie / grafikę do posta" to edit tego posta (instruction np. "zaproponuj zdjęcie"), nie nowy post.`;

export function chatRouterUserPrompt(input: {
  context: ContentContext;
  message: string;
  posts: Array<{ id: string; title: string; excerpt: string }>;
  history: Array<{ role: "user" | "assistant"; text: string }>;
}): string {
  return [
    contentContextBlock(input.context),
    "",
    input.history.length
      ? [
          "Wcześniejsza rozmowa (od najstarszej):",
          ...input.history.map(
            (turn) =>
              `${turn.role === "user" ? "Klient" : "Asystent"}: ${turn.text}`,
          ),
          "",
        ].join("\n")
      : null,
    "Propozycje postów na liście (czekają na akceptację):",
    input.posts.length
      ? input.posts
          .map(
            (post) =>
              `- id: ${post.id}\n  tytuł: ${post.title}\n  początek: ${post.excerpt}`,
          )
          .join("\n")
      : "(brak)",
    "",
    `Wiadomość klienta: ${input.message}`,
  ]
    .filter((line) => line !== null)
    .join("\n");
}

export const POST_CHAT_SYSTEM_PROMPT = `Rozmawiasz z klientem lokalnej firmy o JEDNYM poście do wizytówki Google (w panelu obok widzi ten post).
Zwróć WYŁĄCZNIE JSON jednego z typów:
- { "kind": "reply", "text": string } - rozmowa bez zmian w poście.
- { "kind": "change", "instruction": string, "parts": string[] } - klient WPROST prosi o wprowadzenie zmiany teraz. parts: tylko części posta, których ta zmiana dotyczy: "title", "body" (treść), "image" (grafika). Wybór zdjęcia = ["image"] - treści i tytułu nie ruszaj, chyba że klient o to prosi.
Kiedy change: polecenia wykonania ("zmień", "popraw", "skróć", "dodaj", "usuń", "przepisz", "wygeneruj / zrób zdjęcie", "wprowadź", "zastosuj") albo zgoda na to, co zaproponowałeś wcześniej ("tak, zrób to", "ok, ten drugi", "wprowadź"). instruction: samodzielne, pełne polecenie zmiany po polsku z konkretami ustalonymi w rozmowie (np. dokładny nowy tytuł, opis zdjęcia słowo w słowo, który wariant), tak żeby dało się je wykonać bez czytania rozmowy.
Kiedy reply: pytania, prośby o propozycje, pomysły, warianty, opinię ("zaproponuj", "co myślisz", "jakie zdjęcie tu pasuje", "podpowiedz tytuł") oraz każda wiadomość z zastrzeżeniem "nie zmieniaj / nie generuj jeszcze / sama propozycja". text: konkretna odpowiedź po polsku, maks. ok. 8 zdań; przy propozycjach podaj 2-3 ponumerowane warianty (np. opisy zdjęć, tytuły); zakończ krótkim pytaniem, czy wprowadzić.
Jeśli klient prosi o zmianę na coś, co już jest w poście (np. taki sam tytuł) - reply z informacją, że post już tak wygląda.
Przestrzegaj ZAKAZÓW z kontekstu firmy. Zwracaj się do klienta na "ty" (bez "Pan/Pani"). Bez emotikon i markdownu.`;

export function postChatUserPrompt(input: {
  context: ContentContext;
  post: { title: string; body: string; hasImage: boolean };
  conversation: Array<{ role: "user" | "assistant"; text: string }>;
  message: string;
}): string {
  return [
    contentContextBlock(input.context),
    "",
    `Post - tytuł: ${input.post.title}`,
    "Post - treść:",
    input.post.body,
    `Grafika: ${input.post.hasImage ? "jest" : "brak"}`,
    "",
    input.conversation.length
      ? [
          "Rozmowa (od najstarszej):",
          ...input.conversation.map(
            (turn) =>
              `${turn.role === "user" ? "Klient" : "Asystent"}: ${turn.text}`,
          ),
          "",
        ].join("\n")
      : null,
    `Nowa wiadomość klienta: ${input.message}`,
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
