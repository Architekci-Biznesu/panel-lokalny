import type { ImageProvider, TextProvider } from "@/lib/ai/types";
import {
  openaiImageProvider,
  openaiTextProvider,
} from "@/lib/ai/providers/openai";

export function getTextProvider(): TextProvider {
  const provider = process.env.AI_TEXT_PROVIDER ?? "openai";
  if (provider === "openai") {
    return openaiTextProvider;
  }
  throw new Error(`Unsupported AI_TEXT_PROVIDER: ${provider}`);
}

export function getImageProvider(): ImageProvider {
  const provider = process.env.AI_IMAGE_PROVIDER ?? "openai";
  if (provider === "openai") {
    return openaiImageProvider;
  }
  throw new Error(`Unsupported AI_IMAGE_PROVIDER: ${provider}`);
}

export type {
  BriefFields,
  ChatIntent,
  ChatPostRef,
  ChatTurn,
  ContentContext,
  PostChatResult,
  GeneratedContent,
  GenerateBriefInput,
  TextProvider,
  ImageProvider,
} from "@/lib/ai/types";
