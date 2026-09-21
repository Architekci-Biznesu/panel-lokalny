import OpenAI from "openai";
import { z } from "zod";
import type {
  BriefFields,
  GenerateBriefInput,
  GenerateContentInput,
  GenerateImageInput,
  GenerateReviewReplyInput,
  GenerateTopicInput,
  GeneratedImage,
  ImageProvider,
  TextProvider,
} from "@/lib/ai/types";

const briefSchema = z.object({
  services: z.string(),
  tone: z.string(),
  targetAudience: z.string(),
  differentiators: z.string(),
});

function getClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set");
  }
  return new OpenAI({ apiKey });
}

function textModel() {
  return process.env.OPENAI_TEXT_MODEL || "gpt-4.1-mini";
}

async function completeJson(system: string, user: string): Promise<string> {
  const client = getClient();
  const response = await client.responses.create({
    model: textModel(),
    input: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    text: { format: { type: "json_object" } },
  });
  return response.output_text;
}

async function completeText(system: string, user: string): Promise<string> {
  const client = getClient();
  const response = await client.responses.create({
    model: textModel(),
    input: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });
  return response.output_text.trim();
}

function briefContext(brief: BriefFields): string {
  return [
    `Usługi: ${brief.services}`,
    `Ton: ${brief.tone}`,
    `Grupa: ${brief.targetAudience}`,
    `Wyróżniki: ${brief.differentiators}`,
  ].join("\n");
}

export const openaiTextProvider: TextProvider = {
  async generateBrief(input: GenerateBriefInput): Promise<BriefFields> {
    const system = `Jesteś asystentem marketingowym dla lokalnych firm w Polsce.
Na podstawie materiałów o firmie przygotuj krótki brief startowy.
Zwróć WYŁĄCZNIE JSON o kluczach: services, tone, targetAudience, differentiators.
- services: lista usług po przecinku (po polsku)
- tone: 1-2 zdania o tonie komunikacji (po polsku)
- targetAudience: 1-2 zdania o grupie docelowej (po polsku)
- differentiators: 1-3 konkretne wyróżniki firmy wyciągnięte ze źródła (np. "od 2014", "własna pracownia", "dojazd w 24h"). Unikaj ogólników typu "profesjonalna obsługa" czy "indywidualne podejście". Jeśli źródło nie daje faktów - napisz krótką, ostrożną propozycję na podstawie kontekstu, bez zmyślania szczegółów.
Bez markdownu, bez dodatkowych kluczy.`;

    const userParts = [
      input.companyNameHint ? `Nazwa firmy (wskazówka): ${input.companyNameHint}` : null,
      input.websiteUrl ? `Adres strony: ${input.websiteUrl}` : null,
      "Materiał źródłowy:",
      input.sourceText.slice(0, 12000),
    ];

    if (input.currentBrief) {
      userParts.push(
        "Aktualny brief (punkt wyjścia - zachowaj sensowną treść, chyba że użytkownik każe inaczej):",
        `Usługi: ${input.currentBrief.services}`,
        `Ton: ${input.currentBrief.tone}`,
        `Grupa docelowa: ${input.currentBrief.targetAudience}`,
        `Wyróżniki: ${input.currentBrief.differentiators}`,
      );
    }

    if (input.guidanceNote?.trim()) {
      userParts.push(
        "Wskazówka użytkownika (poprawki i/lub dodatki do uwzględnienia w nowej wersji briefu):",
        input.guidanceNote.trim(),
      );
    }

    const raw = await completeJson(system, userParts.filter(Boolean).join("\n"));
    const parsed = briefSchema.parse(JSON.parse(raw));
    return {
      services: parsed.services.trim(),
      tone: parsed.tone.trim(),
      targetAudience: parsed.targetAudience.trim(),
      differentiators: parsed.differentiators.trim(),
    };
  },

  async generateTopic(input: GenerateTopicInput): Promise<string> {
    return completeText(
      "Proponujesz jeden temat publikacji dla lokalnej firmy. Odpowiedz samym tytułem tematu po polsku.",
      `${briefContext(input.brief)}\nKanał: ${input.channel ?? "ogólny"}`,
    );
  },

  async generateContent(input: GenerateContentInput): Promise<string> {
    return completeText(
      "Piszesz treść publikacji dla lokalnej firmy po polsku. Zwróć samą treść. Opieraj się na konkretnych wyróżnikach, unikaj pustych fraz.",
      `Temat: ${input.topic}\n${briefContext(input.brief)}\nKanał: ${input.channel ?? "ogólny"}`,
    );
  },

  async generateReviewReply(
    input: GenerateReviewReplyInput,
  ): Promise<string> {
    return completeText(
      "Piszesz odpowiedź na opinię klienta lokalnej firmy po polsku. Zwróć samą odpowiedź.",
      `Ocena: ${input.rating}/5\nOpinia: ${input.reviewText}\n${briefContext(input.brief)}`,
    );
  },
};

export const openaiImageProvider: ImageProvider = {
  async generateImage(input: GenerateImageInput): Promise<GeneratedImage> {
    const client = getClient();
    const result = await client.images.generate({
      model: "gpt-image-1",
      prompt: input.prompt,
      size: input.size ?? "1024x1024",
    });
    const b64 = result.data?.[0]?.b64_json;
    if (!b64) {
      throw new Error("Image generation returned no data");
    }
    return { base64: b64, mimeType: "image/png" };
  },
};
