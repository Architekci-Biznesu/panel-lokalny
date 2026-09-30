import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  pgEnum,
  uniqueIndex,
  unique,
  index,
  jsonb,
  integer,
  numeric,
  doublePrecision,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

export const userRoleEnum = pgEnum("user_role", ["owner", "member"]);
export const profileKindEnum = pgEnum("profile_kind", ["local_business"]);
export const companyContextSourceEnum = pgEnum("company_context_source", [
  "website",
  "gbp",
]);
export const oauthProviderEnum = pgEnum("oauth_provider", ["gbp"]);

/** Review replies: customer approves each one, or AI publishes the 3-5 star ones. */
export const reviewModeEnum = pgEnum("review_mode", ["accept", "auto"]);

/** Who speaks in a reply: "Dziękujemy" (team) or "Dziękuję" (owner). */
export const reviewPerspectiveEnum = pgEnum("review_perspective", [
  "team",
  "owner",
]);

/** Tone of a reply: warm and direct, or formal. */
export const reviewStyleEnum = pgEnum("review_style", ["warm", "formal"]);

export const accounts = pgTable("accounts", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  lastActiveAt: timestamp("last_active_at", { withTimezone: true }),
  stripeCustomerId: text("stripe_customer_id"),
});

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  accountId: uuid("account_id")
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" }),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: userRoleEnum("role").notNull().default("owner"),
  isStaff: boolean("is_staff").notNull().default(false),
});

export const profiles = pgTable("profiles", {
  id: uuid("id").defaultRandom().primaryKey(),
  accountId: uuid("account_id")
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  kind: profileKindEnum("kind").notNull().default("local_business"),
  gbpLocationId: text("gbp_location_id"),
  gbpPlaceId: text("gbp_place_id"),
  /** v4 `accounts/{a}/locations/{l}` of gbpLocationId - found once, reused by photos, posts and reviews. */
  gbpV4LocationName: text("gbp_v4_location_name"),
  oauthConnectionId: uuid("oauth_connection_id").references(
    (): AnyPgColumn => oauthConnections.id,
    { onDelete: "set null" },
  ),
  reviewMode: reviewModeEnum("review_mode").notNull().default("accept"),
  /** When auto mode was switched on (null while off) - older reviews are never answered automatically. */
  reviewAutoSince: timestamp("review_auto_since", { withTimezone: true }),
  /** Customer's extra guidelines for every generated reply. */
  reviewReplyInstructions: text("review_reply_instructions"),
  /** One line under every reply, e.g. "Zespół Pizzerii Roma". */
  reviewSignature: text("review_signature"),
  reviewPerspective: reviewPerspectiveEnum("review_perspective")
    .notNull()
    .default("team"),
  reviewStyle: reviewStyleEnum("review_style").notNull().default("warm"),
  /** Guidelines per star rating: { "1": "...", ..., "5": "..." } - each added only to replies for that rating. */
  reviewRatingInstructions: jsonb("review_rating_instructions").$type<Partial<
    Record<"1" | "2" | "3" | "4" | "5", string>
  > | null>(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const publishGroups = pgTable("publish_groups", {
  id: uuid("id").defaultRandom().primaryKey(),
  accountId: uuid("account_id")
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
});

export const profileGroups = pgTable(
  "profile_groups",
  {
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    groupId: uuid("group_id")
      .notNull()
      .references(() => publishGroups.id, { onDelete: "cascade" }),
  },
  (table) => [
    uniqueIndex("profile_groups_profile_id_uidx").on(table.profileId),
  ],
);

export const profileBriefs = pgTable(
  "profile_briefs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    services: text("services").notNull().default(""),
    tone: text("tone").notNull().default(""),
    targetAudience: text("target_audience").notNull().default(""),
    differentiators: text("differentiators"),
    serviceArea: text("service_area"),
    avoid: text("avoid"),
    outOfScope: text("out_of_scope"),
    websiteUrl: text("website_url"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("profile_briefs_profile_id_uidx").on(table.profileId),
  ],
);

export const companyContext = pgTable("company_context", {
  id: uuid("id").defaultRandom().primaryKey(),
  profileId: uuid("profile_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  source: companyContextSourceEnum("source").notNull(),
  rawData: jsonb("raw_data").notNull(),
  fetchedAt: timestamp("fetched_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/** Encrypted OAuth tokens - one row per Google account connection, shared by a location batch. */
export const oauthConnections = pgTable("oauth_connections", {
  id: uuid("id").defaultRandom().primaryKey(),
  accountId: uuid("account_id")
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" }),
  provider: oauthProviderEnum("provider").notNull(),
  encryptedAccessToken: text("encrypted_access_token").notNull(),
  encryptedRefreshToken: text("encrypted_refresh_token"),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  scopes: text("scopes"),
  externalAccountEmail: text("external_account_email"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/** In-progress onboarding state before activeProfileId is set (or while mode=add). */
export const onboardingDrafts = pgTable(
  "onboarding_drafts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    mode: text("mode").notNull().default("new"),
    step: text("step").notNull().default("1"),
    profileId: uuid("profile_id").references(() => profiles.id, {
      onDelete: "set null",
    }),
    websiteUrl: text("website_url"),
    manualDescription: text("manual_description"),
    scrapeText: text("scrape_text"),
    scrapeWarning: text("scrape_warning"),
    services: text("services"),
    tone: text("tone"),
    targetAudience: text("target_audience"),
    differentiators: text("differentiators"),
    briefDirty: text("brief_dirty"),
    oauthConnectionId: uuid("oauth_connection_id").references(
      (): AnyPgColumn => oauthConnections.id,
      { onDelete: "set null" },
    ),
    profileName: text("profile_name"),
    websiteScrape: jsonb("website_scrape"),
    pendingGbpLocations: jsonb("pending_gbp_locations"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("onboarding_drafts_account_mode_uidx").on(
      table.accountId,
      table.mode,
    ),
  ],
);

export const accountsRelations = relations(accounts, ({ many }) => ({
  users: many(users),
  profiles: many(profiles),
  publishGroups: many(publishGroups),
  oauthConnections: many(oauthConnections),
  onboardingDrafts: many(onboardingDrafts),
}));

export const usersRelations = relations(users, ({ one }) => ({
  account: one(accounts, {
    fields: [users.accountId],
    references: [accounts.id],
  }),
}));

export const profilesRelations = relations(profiles, ({ one, many }) => ({
  account: one(accounts, {
    fields: [profiles.accountId],
    references: [accounts.id],
  }),
  profileGroups: many(profileGroups),
  brief: one(profileBriefs),
  companyContexts: many(companyContext),
  oauthConnection: one(oauthConnections, {
    fields: [profiles.oauthConnectionId],
    references: [oauthConnections.id],
  }),
  rankKeywords: many(rankKeywords),
  rankScans: many(rankScans),
}));

export const publishGroupsRelations = relations(
  publishGroups,
  ({ one, many }) => ({
    account: one(accounts, {
      fields: [publishGroups.accountId],
      references: [accounts.id],
    }),
    profileGroups: many(profileGroups),
  }),
);

export const profileGroupsRelations = relations(profileGroups, ({ one }) => ({
  profile: one(profiles, {
    fields: [profileGroups.profileId],
    references: [profiles.id],
  }),
  group: one(publishGroups, {
    fields: [profileGroups.groupId],
    references: [publishGroups.id],
  }),
}));

export const profileBriefsRelations = relations(profileBriefs, ({ one }) => ({
  profile: one(profiles, {
    fields: [profileBriefs.profileId],
    references: [profiles.id],
  }),
}));

export const companyContextRelations = relations(companyContext, ({ one }) => ({
  profile: one(profiles, {
    fields: [companyContext.profileId],
    references: [profiles.id],
  }),
}));

export const oauthConnectionsRelations = relations(
  oauthConnections,
  ({ one, many }) => ({
    account: one(accounts, {
      fields: [oauthConnections.accountId],
      references: [accounts.id],
    }),
    profiles: many(profiles),
  }),
);

export type Account = typeof accounts.$inferSelect;
export type User = typeof users.$inferSelect;
export type Profile = typeof profiles.$inferSelect;
export type ProfileBrief = typeof profileBriefs.$inferSelect;
export type CompanyContext = typeof companyContext.$inferSelect;
export type OAuthConnection = typeof oauthConnections.$inferSelect;
export type OnboardingDraft = typeof onboardingDrafts.$inferSelect;

export const gbpSuggestionFieldEnum = pgEnum("gbp_suggestion_field", [
  "title",
  "description",
  "primary_category",
  "additional_categories",
  "services",
]);

export const gbpSuggestionRiskEnum = pgEnum("gbp_suggestion_risk", [
  "none",
  "high",
]);

export const gbpSuggestionStatusEnum = pgEnum("gbp_suggestion_status", [
  "pending",
  "accepted",
  "rejected",
  "superseded",
]);

export const gbpAuditRunStatusEnum = pgEnum("gbp_audit_run_status", [
  "running",
  "done",
  "failed",
]);

export const gbpSuggestions = pgTable("gbp_suggestions", {
  id: uuid("id").defaultRandom().primaryKey(),
  profileId: uuid("profile_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  field: gbpSuggestionFieldEnum("field").notNull(),
  currentValue: text("current_value"),
  suggestedValue: text("suggested_value").notNull(),
  rationale: text("rationale"),
  risk: gbpSuggestionRiskEnum("risk").notNull().default("none"),
  status: gbpSuggestionStatusEnum("status").notNull().default("pending"),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  riskAckAt: timestamp("risk_ack_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const gbpAuditRuns = pgTable("gbp_audit_runs", {
  id: uuid("id").defaultRandom().primaryKey(),
  profileId: uuid("profile_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  status: gbpAuditRunStatusEnum("status").notNull().default("running"),
  error: text("error"),
  /** Competitor Local Pack insights + suggested rank phrases from last audit. */
  insights: jsonb("insights").$type<Record<string, unknown> | null>(),
  startedAt: timestamp("started_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
});

export const napInterestRequests = pgTable("nap_interest_requests", {
  id: uuid("id").defaultRandom().primaryKey(),
  profileId: uuid("profile_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type GbpSuggestion = typeof gbpSuggestions.$inferSelect;
export type GbpAuditRun = typeof gbpAuditRuns.$inferSelect;
export type NapInterestRequest = typeof napInterestRequests.$inferSelect;

export const rankScanStatusEnum = pgEnum("rank_scan_status", [
  "running",
  "done",
  "failed",
]);

export const rankMatchMethodEnum = pgEnum("rank_match_method", [
  "place_id",
  "name_fallback",
  "none",
]);

export const rankKeywords = pgTable(
  "rank_keywords",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    phrase: text("phrase").notNull(),
    defaultRadiusKm: numeric("default_radius_km", { precision: 6, scale: 2 })
      .notNull()
      .default("10"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("rank_keywords_profile_id_idx").on(table.profileId)],
);

export type LocalPackSnapshotItem = {
  position: number;
  title: string;
  placeId: string | null;
  rating: number | null;
  reviews: number | null;
  address: string | null;
};

export const rankScans = pgTable(
  "rank_scans",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    keywordId: uuid("keyword_id")
      .notNull()
      .references(() => rankKeywords.id, { onDelete: "cascade" }),
    gridSize: integer("grid_size").notNull(),
    radiusKm: numeric("radius_km", { precision: 6, scale: 2 }).notNull(),
    zoom: integer("zoom").notNull().default(14),
    status: rankScanStatusEnum("status").notNull().default("running"),
    error: text("error"),
    localPackPosition: integer("local_pack_position"),
    localPackResults:
      jsonb("local_pack_results").$type<LocalPackSnapshotItem[]>(),
    agr: numeric("agr", { precision: 8, scale: 3 }),
    atgr: numeric("atgr", { precision: 8, scale: 4 }),
    shareToken: text("share_token"),
    startedAt: timestamp("started_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (table) => [
    index("rank_scans_profile_id_idx").on(table.profileId),
    index("rank_scans_keyword_id_idx").on(table.keywordId),
    uniqueIndex("rank_scans_share_token_uidx").on(table.shareToken),
  ],
);

export const rankResults = pgTable(
  "rank_results",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    scanId: uuid("scan_id")
      .notNull()
      .references(() => rankScans.id, { onDelete: "cascade" }),
    lat: doublePrecision("lat").notNull(),
    lng: doublePrecision("lng").notNull(),
    position: integer("position"),
    matchMethod: rankMatchMethodEnum("match_method").notNull(),
    checkedAt: timestamp("checked_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("rank_results_scan_id_idx").on(table.scanId)],
);

export const rankKeywordsRelations = relations(
  rankKeywords,
  ({ one, many }) => ({
    profile: one(profiles, {
      fields: [rankKeywords.profileId],
      references: [profiles.id],
    }),
    scans: many(rankScans),
  }),
);

export const rankScansRelations = relations(rankScans, ({ one, many }) => ({
  profile: one(profiles, {
    fields: [rankScans.profileId],
    references: [profiles.id],
  }),
  keyword: one(rankKeywords, {
    fields: [rankScans.keywordId],
    references: [rankKeywords.id],
  }),
  results: many(rankResults),
}));

export const rankResultsRelations = relations(rankResults, ({ one }) => ({
  scan: one(rankScans, {
    fields: [rankResults.scanId],
    references: [rankScans.id],
  }),
}));

export type RankKeyword = typeof rankKeywords.$inferSelect;
export type RankScan = typeof rankScans.$inferSelect;
export type RankResult = typeof rankResults.$inferSelect;

// --- Faza 4: pętla contentowa (Publikacje) ---

export const contentTypeEnum = pgEnum("content_type", ["post", "blog"]);

export const contentStatusEnum = pgEnum("content_status", [
  "draft",
  "pending",
  "accepted",
  "rejected",
]);

/** Who wrote the post: AI proposal or the customer by hand. */
export const contentOriginEnum = pgEnum("content_origin", ["ai", "manual"]);

export const contentChannelEnum = pgEnum("content_channel", [
  "gbp",
  "facebook",
  "instagram",
]);

export const contentTargetStatusEnum = pgEnum("content_target_status", [
  "queued",
  "scheduled",
  "published",
  "failed",
]);

/** One piece of content; profile_id is the author / source profile. */
export const contentItems = pgTable(
  "content_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    /** Shared post of a publish group - visible from every profile in it. */
    groupId: uuid("group_id").references(() => publishGroups.id, {
      onDelete: "set null",
    }),
    type: contentTypeEnum("type").notNull().default("post"),
    origin: contentOriginEnum("origin").notNull().default("ai"),
    status: contentStatusEnum("status").notNull().default("pending"),
    topic: text("topic").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    imageUrl: text("image_url"),
    imageKey: text("image_key"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("content_items_profile_id_idx").on(table.profileId),
    index("content_items_group_id_idx").on(table.groupId),
    index("content_items_status_idx").on(table.status),
  ],
);

/** Where one content item goes - one row per profile + channel. */
export const contentTargets = pgTable(
  "content_targets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    contentItemId: uuid("content_item_id")
      .notNull()
      .references(() => contentItems.id, { onDelete: "cascade" }),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    channel: contentChannelEnum("channel").notNull(),
    status: contentTargetStatusEnum("status").notNull().default("queued"),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    /** Google localPost `name` - needed to find or delete the post later. */
    externalId: text("external_id"),
    error: text("error"),
  },
  (table) => [
    uniqueIndex("content_targets_item_profile_channel_uidx").on(
      table.contentItemId,
      table.profileId,
      table.channel,
    ),
    index("content_targets_profile_id_idx").on(table.profileId),
    index("content_targets_status_idx").on(table.status),
    index("content_targets_scheduled_at_idx").on(table.scheduledAt),
  ],
);

/** Chat edit history: the version before each change and the instruction that changed it. */
export const contentRevisions = pgTable(
  "content_revisions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    contentItemId: uuid("content_item_id")
      .notNull()
      .references(() => contentItems.id, { onDelete: "cascade" }),
    /** Title before the change - null when the change kept the title. */
    title: text("title"),
    body: text("body").notNull(),
    imageUrl: text("image_url"),
    instruction: text("instruction").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("content_revisions_content_item_id_idx").on(table.contentItemId),
  ],
);

export const contentGenerationKindEnum = pgEnum("content_generation_kind", [
  "posts",
  "topics",
]);

export const contentGenerationStatusEnum = pgEnum("content_generation_status", [
  "running",
  "done",
  "failed",
]);

/** Background batch of AI proposals (after onboarding, "Wygeneruj kolejne", chat). */
export const contentGenerationRuns = pgTable(
  "content_generation_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    groupId: uuid("group_id").references(() => publishGroups.id, {
      onDelete: "set null",
    }),
    kind: contentGenerationKindEnum("kind").notNull().default("posts"),
    status: contentGenerationStatusEnum("status").notNull().default("running"),
    /** Topics a "posts" run writes from (ids of content_topics) */
    topicIds: jsonb("topic_ids").$type<string[] | null>(),
    requested: integer("requested").notNull(),
    created: integer("created").notNull().default(0),
    request: text("request"),
    error: text("error"),
    startedAt: timestamp("started_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (table) => [
    index("content_generation_runs_profile_id_idx").on(table.profileId),
    index("content_generation_runs_group_id_idx").on(table.groupId),
  ],
);

export const contentTopicStatusEnum = pgEnum("content_topic_status", [
  "open",
  "used",
  "dismissed",
]);

/** Post topics to choose from before AI writes posts (kept for later). */
export const contentTopics = pgTable(
  "content_topics",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    /** Shared topic of a publish group - visible from every profile in it. */
    groupId: uuid("group_id").references(() => publishGroups.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    origin: contentOriginEnum("origin").notNull().default("ai"),
    status: contentTopicStatusEnum("status").notNull().default("open"),
    /** Post written from this topic */
    contentItemId: uuid("content_item_id").references(() => contentItems.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
  },
  (table) => [
    index("content_topics_profile_id_idx").on(table.profileId),
    index("content_topics_group_id_idx").on(table.groupId),
    index("content_topics_status_idx").on(table.status),
  ],
);

export type ContentTopic = typeof contentTopics.$inferSelect;
export type ContentItem = typeof contentItems.$inferSelect;
export type ContentGenerationRun = typeof contentGenerationRuns.$inferSelect;
export type ContentTarget = typeof contentTargets.$inferSelect;
export type ContentRevision = typeof contentRevisions.$inferSelect;
export type ContentChannel = (typeof contentChannelEnum.enumValues)[number];
export type ContentTargetStatus =
  (typeof contentTargetStatusEnum.enumValues)[number];
export type ContentStatus = (typeof contentStatusEnum.enumValues)[number];

export const reviewReplySourceEnum = pgEnum("review_reply_source", [
  "panel",
  "external",
]);

export const reviewDraftStatusEnum = pgEnum("review_draft_status", [
  "none",
  "generating",
  "ready",
  "failed",
]);

export const reviewPublishStatusEnum = pgEnum("review_publish_status", [
  "idle",
  "publishing",
  "failed",
]);

export const reviewSyncStatusEnum = pgEnum("review_sync_status", [
  "running",
  "done",
  "failed",
]);

/** One review of a profile, per channel (only Google is implemented). */
export const reviews = pgTable(
  "reviews",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    channel: contentChannelEnum("channel").notNull().default("gbp"),
    /** Channel-side id (Google: reviewId) */
    externalId: text("external_id").notNull(),
    /** 1-5; null when the channel sent no usable rating */
    rating: integer("rating"),
    authorName: text("author_name").notNull().default(""),
    authorPhotoUrl: text("author_photo_url"),
    /** Raw text as the channel sent it (may hold a "(Translated by Google)" block); null = stars only */
    comment: text("comment"),
    /** The author's own words when `comment` is a Google translation */
    commentOriginal: text("comment_original"),
    reviewCreatedAt: timestamp("review_created_at", { withTimezone: true }),
    reviewUpdatedAt: timestamp("review_updated_at", { withTimezone: true }),
    /** Reply that is public right now - never touched by editing a draft */
    replyText: text("reply_text"),
    replySource: reviewReplySourceEnum("reply_source"),
    repliedAt: timestamp("replied_at", { withTimezone: true }),
    /** AI proposal or the version being edited */
    draftText: text("draft_text"),
    draftStatus: reviewDraftStatusEnum("draft_status")
      .notNull()
      .default("none"),
    publishStatus: reviewPublishStatusEnum("publish_status")
      .notNull()
      .default("idle"),
    publishError: text("publish_error"),
    /** The customer saved the draft by hand (AI drafts leave it null) */
    draftEditedAt: timestamp("draft_edited_at", { withTimezone: true }),
    /** The review changed after an edited draft was written - check before publishing */
    draftOutdatedAt: timestamp("draft_outdated_at", { withTimezone: true }),
    /** When the panel first saw this review - gates automatic replies */
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("reviews_profile_channel_external_idx").on(
      table.profileId,
      table.channel,
      table.externalId,
    ),
    index("reviews_profile_updated_idx").on(
      table.profileId,
      table.reviewUpdatedAt,
    ),
  ],
);

/** One synchronization of a profile's reviews with the channel. */
export const reviewSyncRuns = pgTable(
  "review_sync_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    status: reviewSyncStatusEnum("status").notNull().default("running"),
    /** Reviews read from the channel in this run */
    fetched: integer("fetched").notNull().default(0),
    /** Reviews the panel had not seen before */
    newCount: integer("new_count").notNull().default(0),
    /** From the channel's answer: overall rating and number of reviews */
    averageRating: numeric("average_rating", { precision: 3, scale: 2 }),
    totalCount: integer("total_count"),
    error: text("error"),
    startedAt: timestamp("started_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (table) => [
    index("review_sync_runs_profile_started_idx").on(
      table.profileId,
      table.startedAt,
    ),
    // One running sync per profile at a time (the database enforces it).
    uniqueIndex("review_sync_runs_one_running_idx")
      .on(table.profileId)
      .where(sql`${table.status} = 'running'`),
  ],
);

export type Review = typeof reviews.$inferSelect;
export type ReviewSyncRun = typeof reviewSyncRuns.$inferSelect;
export type ReviewMode = (typeof reviewModeEnum.enumValues)[number];
export type ReviewPerspective =
  (typeof reviewPerspectiveEnum.enumValues)[number];
export type ReviewStyle = (typeof reviewStyleEnum.enumValues)[number];

export const gbpSnapshotKindEnum = pgEnum("gbp_snapshot_kind", [
  "location",
  "media",
  "metrics",
  "categories",
  "attribute_metadata",
]);

/**
 * Last copy of data read from Google, so pages open without waiting for it.
 * `profileId` null = shared public dictionaries (categories, attribute
 * metadata) - never data of a single listing.
 */
export const gbpSnapshots = pgTable(
  "gbp_snapshots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    profileId: uuid("profile_id").references(() => profiles.id, {
      onDelete: "cascade",
    }),
    kind: gbpSnapshotKindEnum("kind").notNull(),
    key: text("key").notNull(),
    data: jsonb("data").notNull(),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull(),
    /** Set while one request refreshes the row - others keep serving the old copy. */
    refreshingSince: timestamp("refreshing_since", { withTimezone: true }),
  },
  (table) => [
    unique("gbp_snapshots_profile_kind_key_uq")
      .on(table.profileId, table.kind, table.key)
      .nullsNotDistinct(),
  ],
);

export type GbpSnapshot = typeof gbpSnapshots.$inferSelect;
export type GbpSnapshotKind = (typeof gbpSnapshotKindEnum.enumValues)[number];
