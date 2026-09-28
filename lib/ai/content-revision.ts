import { clampTextToLimit } from "@/lib/ai/gbp-limits";
import type {
  GeneratedContent,
  GenerateContentInput,
  PostPart,
} from "@/lib/ai/types";

export const POST_PARTS: readonly PostPart[] = ["title", "body", "image"];

const IMAGE_WORDS =
  /(zdję|zdjec|grafik|obraz|obrazek|foto|fotk|ilustracj|miniatur|image|picture|photo)/i;

/**
 * True only when the instruction itself asks about the image. The post's own
 * title is removed first - a post "about photos" must not trigger a new image.
 */
export function instructionAsksForImage(
  instruction: string,
  previousTitle: string,
): boolean {
  const own = previousTitle
    ? instruction.split(previousTitle).join(" ")
    : instruction;
  return IMAGE_WORDS.test(own);
}

const TITLE_WORDS = /(tytu|nagłów|naglow|nazw[aęy] posta|headline|title)/i;

/** True only when the instruction itself mentions the title ("opis" = treść, not the title). */
export function instructionAsksForTitle(
  instruction: string,
  previousTitle: string,
): boolean {
  const own = previousTitle
    ? instruction.split(previousTitle).join(" ")
    : instruction;
  return TITLE_WORDS.test(own);
}

export type RawGeneratedContent = {
  changes?: string[] | null;
  body?: string | null;
  title?: string | null;
  newImagePrompt?: string | null;
};

/**
 * Turns the model's answer into the result. On a chat edit only the parts
 * listed in `changes` are taken - the model tends to rewrite the text even
 * when asked only for a new title, so the code enforces the scope.
 */
export function mergeGeneratedContent(
  raw: RawGeneratedContent,
  revision: GenerateContentInput["revision"],
  maxLength: number,
): GeneratedContent {
  if (!revision) {
    const body = raw.body?.trim();
    if (!body) throw new Error("AI nie zwróciło treści posta");
    return {
      body: clampTextToLimit(body, maxLength),
      title: null,
      newImagePrompt: null,
    };
  }

  // Only parts the model changed AND the customer agreed to (when known).
  const allowed = new Set<PostPart>(revision.parts ?? POST_PARTS);
  const changes = new Set(
    (raw.changes ?? []).filter(
      (part): part is PostPart =>
        (POST_PARTS as readonly string[]).includes(part) &&
        allowed.has(part as PostPart),
    ),
  );
  const title = raw.title?.trim().replace(/[.]+$/, "") ?? "";
  const body = raw.body?.trim() ?? "";
  const image = raw.newImagePrompt?.trim() ?? "";

  return {
    body:
      changes.has("body") && body
        ? clampTextToLimit(body, maxLength)
        : revision.previousBody,
    title:
      changes.has("title") &&
      title &&
      title !== revision.previousTitle &&
      instructionAsksForTitle(revision.instruction, revision.previousTitle)
        ? title.slice(0, 160)
        : null,
    newImagePrompt:
      changes.has("image") &&
      image &&
      instructionAsksForImage(revision.instruction, revision.previousTitle)
        ? image
        : null,
  };
}
