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

export type GenerateTopicsInput = {
  context: ContentContext;
  count: number;
  /** Topics already used or waiting on the list - never propose them again */
  exclude: string[];
};

export type GenerateContentInput = {
  context: ContentContext;
  topic: string;
  channel?: string;
  /** Chat edit: rewrite the post following `instruction` */
  revision?: {
    previousTitle: string;
    previousBody: string;
    instruction: string;
    /** Earlier customer requests about this post, oldest first */
    history?: string[];
    /** Parts the customer agreed to change - nothing outside them changes */
    parts?: PostPart[];
  } | null;
};

export type GeneratedContent = {
  body: string;
  /** Chat edit only: new title when the customer asked to change it, else null. */
  title: string | null;
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

/** A pending post the chat can refer to ("zmień tytuł posta o oponach"). */
export type ChatPostRef = { id: string; title: string; excerpt: string };

/** Earlier chat turn - lets the router read an answer to its own question. */
export type ChatTurn = { role: "user" | "assistant"; text: string };

export type RouteContentChatInput = {
  /** Business context, so the chat can also answer questions and suggest ideas */
  context: ContentContext;
  message: string;
  posts: ChatPostRef[];
  /** Recent turns of the general chat, oldest first */
  history: ChatTurn[];
};

/** What a chat message means (validated against the offered posts). */
export type ChatIntent =
  | { kind: "create"; count: number; request: string }
  | { kind: "edit"; postId: string; instruction: string }
  | { kind: "clarify"; question: string }
  /** Conversation only - ideas, answers, opinions; nothing changes */
  | { kind: "reply"; text: string };

/** Parts of a post a chat change may touch. */
export type PostPart = "title" | "body" | "image";

/** One message in the chat about a single post. */
export type PostChatInput = {
  context: ContentContext;
  post: { title: string; body: string; hasImage: boolean };
  /** Earlier turns (customer and assistant), oldest first */
  conversation: ChatTurn[];
  message: string;
};

/**
 * Talk (reply) or an explicit request to change the post. `instruction` is
 * self-contained - it carries details agreed earlier in the conversation.
 */
export type PostChatResult =
  | { kind: "reply"; text: string }
  | { kind: "change"; instruction: string; parts: PostPart[] };

export interface TextProvider {
  generateBrief(input: GenerateBriefInput): Promise<BriefFields>;
  generateTopic(input: GenerateTopicInput): Promise<string>;
  /** A list of distinct post topics for the customer to choose from. */
  generateTopics(input: GenerateTopicsInput): Promise<string[]>;
  generateContent(input: GenerateContentInput): Promise<GeneratedContent>;
  /** Decides whether a chat message creates new posts or edits an existing one. */
  routeContentChat(input: RouteContentChatInput): Promise<ChatIntent>;
  /** Chat about one post: answer, or turn an explicit request into a change. */
  respondToPostChat(input: PostChatInput): Promise<PostChatResult>;
  generateReviewReply(input: GenerateReviewReplyInput): Promise<string>;
  generateGbpAuditSuggestions(
    input: GenerateGbpAuditInput,
  ): Promise<GbpAuditSuggestion[]>;
}

export interface ImageProvider {
  generateImage(input: GenerateImageInput): Promise<GeneratedImage>;
}
