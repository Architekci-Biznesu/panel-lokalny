export type BriefFields = {
  services: string;
  tone: string;
  targetAudience: string;
  differentiators: string;
};

export type GenerateBriefInput = {
  sourceText: string;
  websiteUrl?: string | null;
  companyNameHint?: string | null;
  /** Current brief when regenerating with user guidance */
  currentBrief?: BriefFields | null;
  /** Free-text instruction: what to change or add */
  guidanceNote?: string | null;
};

export type GenerateTopicInput = {
  brief: BriefFields;
  channel?: string;
};

export type GenerateContentInput = {
  brief: BriefFields;
  topic: string;
  channel?: string;
};

export type GenerateReviewReplyInput = {
  brief: BriefFields;
  reviewText: string;
  rating: number;
};

export type GenerateImageInput = {
  prompt: string;
  size?: "1024x1024" | "1024x1536" | "1536x1024";
};

export type GeneratedImage = {
  base64: string;
  mimeType: string;
};

export interface TextProvider {
  generateBrief(input: GenerateBriefInput): Promise<BriefFields>;
  generateTopic(input: GenerateTopicInput): Promise<string>;
  generateContent(input: GenerateContentInput): Promise<string>;
  generateReviewReply(input: GenerateReviewReplyInput): Promise<string>;
}

export interface ImageProvider {
  generateImage(input: GenerateImageInput): Promise<GeneratedImage>;
}
