import { GBP_POST_MAX } from "@/lib/ai/content-prompts";

/** Limits for posts written or edited by hand (form and server action share them). */
export const MANUAL_TITLE_MAX = 160;
export const MANUAL_BODY_MAX = GBP_POST_MAX;

export type ManualPostCheck =
  { ok: true; title: string; body: string } | { ok: false; error: string };

export function checkManualPost(input: {
  title: string;
  body: string;
}): ManualPostCheck {
  const title = input.title.replace(/\s+/g, " ").trim();
  const body = input.body.replace(/\r\n/g, "\n").trim();
  if (!title) return { ok: false, error: "Wpisz tytuł posta" };
  if (title.length > MANUAL_TITLE_MAX) {
    return {
      ok: false,
      error: `Tytuł może mieć maks. ${MANUAL_TITLE_MAX} znaków`,
    };
  }
  if (!body) return { ok: false, error: "Wpisz treść posta" };
  if (body.length > MANUAL_BODY_MAX) {
    return {
      ok: false,
      error: `Treść posta w Google może mieć maks. ${MANUAL_BODY_MAX} znaków`,
    };
  }
  return { ok: true, title, body };
}

/** History label for a manual text edit. */
export function manualEditLabel(titleChanged: boolean, bodyChanged: boolean) {
  if (titleChanged && bodyChanged) return "Edycja ręczna: tytuł i treść";
  return titleChanged ? "Edycja ręczna: tytuł" : "Edycja ręczna: treść";
}
