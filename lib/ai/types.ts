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

/**
 * Everything the content loop knows about a profile. `avoid` and `outOfScope`
 * are hard bans in the prompt; `recentTitles` stops repeating recent topics.
 */
export type ContentContext = {
  brief: BriefFields;
  businessName: string;
  serviceArea?: string | null;
  avoid?: string | null;
  outOfScope?: string | null;
  /** Category names from the saved Google profile snapshot */
  categories: string[];
  /** Service names from the saved Google profile snapshot */
  services: string[];
  /** Titles of this profile's latest publications, newest first */
  recentTitles: string[];
};

export type GenerateTopicInput = {
  context: ContentContext;
  channel?: string;
  /** What the customer asked to write about (manual request) */
  request?: string | null;
};

export type GenerateContentInput = {
  context: ContentContext;
  topic: string;
  channel?: string;
  /** Chat edit: rewrite `previousBody` following `instruction` */
  revision?: {
    previousBody: string;
    instruction: string;
  } | null;
};

export type GeneratedContent = {
  body: string;
  /**
   * Set only when the customer asked for a new image in a chat edit -
   * a prompt for the image provider. Null keeps the current image.
   */
  newImagePrompt: string | null;
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
  hoursStats?: {
    ourWeeklyMinutes: number;
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
  generateContent(input: GenerateContentInput): Promise<GeneratedContent>;
  generateReviewReply(input: GenerateReviewReplyInput): Promise<string>;
  generateGbpAuditSuggestions(
    input: GenerateGbpAuditInput,
  ): Promise<GbpAuditSuggestion[]>;
}

export interface ImageProvider {
  generateImage(input: GenerateImageInput): Promise<GeneratedImage>;
}
