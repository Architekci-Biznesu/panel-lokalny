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

export type GbpAuditSuggestionField =
  | "title"
  | "description"
  | "primary_category"
  | "additional_categories"
  | "services";

export type GbpAuditSuggestion = {
  field: GbpAuditSuggestionField;
  /** Plain text for title/description; JSON string for categories/services */
  suggestedValue: string;
  rationale: string;
};

export type CompetitorInsightsForAudit = {
  phrases: string[];
  categoryStats: Array<{ gcid: string; displayName: string; count: number }>;
  titleSamples: string[];
  descriptionSamples: string[];
  photoStats: {
    ourCount: number;
    competitorMedian: number | null;
    competitorMax: number | null;
  } | null;
};

export type GenerateGbpAuditInput = {
  brief: BriefFields & {
    serviceArea?: string | null;
    avoid?: string | null;
    outOfScope?: string | null;
    websiteUrl?: string | null;
    notes?: string | null;
  };
  websiteContext?: string | null;
  gbpContext?: string | null;
  locationSnapshot: string;
  availableCategories: Array<{ name: string; displayName: string }>;
  serviceTypes: Array<{ serviceTypeId: string; displayName: string }>;
  availableAttributes: Array<{ parent: string; displayName?: string }>;
  rejectedSuggestions: Array<{
    field: string;
    suggestedValue: string;
  }>;
  competitorInsights?: CompetitorInsightsForAudit | null;
};

export interface TextProvider {
  generateBrief(input: GenerateBriefInput): Promise<BriefFields>;
  generateTopic(input: GenerateTopicInput): Promise<string>;
  generateContent(input: GenerateContentInput): Promise<string>;
  generateReviewReply(input: GenerateReviewReplyInput): Promise<string>;
  generateGbpAuditSuggestions(
    input: GenerateGbpAuditInput,
  ): Promise<GbpAuditSuggestion[]>;
}

export interface ImageProvider {
  generateImage(input: GenerateImageInput): Promise<GeneratedImage>;
}
