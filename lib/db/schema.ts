import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  pgEnum,
  uniqueIndex,
  index,
  jsonb,
  integer,
  numeric,
  doublePrecision,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const userRoleEnum = pgEnum("user_role", ["owner", "member"]);
export const profileKindEnum = pgEnum("profile_kind", ["local_business"]);
export const companyContextSourceEnum = pgEnum("company_context_source", [
  "website",
  "gbp",
]);
export const oauthProviderEnum = pgEnum("oauth_provider", ["gbp"]);

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
  oauthConnectionId: uuid("oauth_connection_id").references(
    (): AnyPgColumn => oauthConnections.id,
    { onDelete: "set null" },
  ),
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
