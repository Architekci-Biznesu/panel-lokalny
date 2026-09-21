CREATE TYPE "public"."company_context_source" AS ENUM('website', 'gbp');--> statement-breakpoint
CREATE TYPE "public"."oauth_provider" AS ENUM('gbp');--> statement-breakpoint
CREATE TABLE "company_context" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"source" "company_context_source" NOT NULL,
	"raw_data" jsonb NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oauth_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"provider" "oauth_provider" NOT NULL,
	"encrypted_access_token" text NOT NULL,
	"encrypted_refresh_token" text,
	"expires_at" timestamp with time zone,
	"scopes" text,
	"external_account_email" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "onboarding_drafts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"mode" text DEFAULT 'new' NOT NULL,
	"step" text DEFAULT '1' NOT NULL,
	"profile_id" uuid,
	"website_url" text,
	"manual_description" text,
	"scrape_text" text,
	"scrape_warning" text,
	"services" text,
	"tone" text,
	"target_audience" text,
	"brief_dirty" text,
	"oauth_connection_id" uuid,
	"pending_gbp_locations" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profile_briefs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"services" text DEFAULT '' NOT NULL,
	"tone" text DEFAULT '' NOT NULL,
	"target_audience" text DEFAULT '' NOT NULL,
	"website_url" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "gbp_location_id" text;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "oauth_connection_id" uuid;--> statement-breakpoint
ALTER TABLE "company_context" ADD CONSTRAINT "company_context_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_connections" ADD CONSTRAINT "oauth_connections_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_drafts" ADD CONSTRAINT "onboarding_drafts_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_drafts" ADD CONSTRAINT "onboarding_drafts_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_drafts" ADD CONSTRAINT "onboarding_drafts_oauth_connection_id_oauth_connections_id_fk" FOREIGN KEY ("oauth_connection_id") REFERENCES "public"."oauth_connections"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_briefs" ADD CONSTRAINT "profile_briefs_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "onboarding_drafts_account_mode_uidx" ON "onboarding_drafts" USING btree ("account_id","mode");--> statement-breakpoint
CREATE UNIQUE INDEX "profile_briefs_profile_id_uidx" ON "profile_briefs" USING btree ("profile_id");--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_oauth_connection_id_oauth_connections_id_fk" FOREIGN KEY ("oauth_connection_id") REFERENCES "public"."oauth_connections"("id") ON DELETE set null ON UPDATE no action;