CREATE TYPE "public"."review_draft_status" AS ENUM('none', 'generating', 'ready', 'failed');--> statement-breakpoint
CREATE TYPE "public"."review_mode" AS ENUM('accept', 'auto');--> statement-breakpoint
CREATE TYPE "public"."review_publish_status" AS ENUM('idle', 'publishing', 'failed');--> statement-breakpoint
CREATE TYPE "public"."review_reply_source" AS ENUM('panel', 'external');--> statement-breakpoint
CREATE TYPE "public"."review_sync_status" AS ENUM('running', 'done', 'failed');--> statement-breakpoint
CREATE TABLE "review_sync_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"status" "review_sync_status" DEFAULT 'running' NOT NULL,
	"fetched" integer DEFAULT 0 NOT NULL,
	"new_count" integer DEFAULT 0 NOT NULL,
	"average_rating" numeric(3, 2),
	"total_count" integer,
	"error" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"channel" "content_channel" DEFAULT 'gbp' NOT NULL,
	"external_id" text NOT NULL,
	"rating" integer,
	"author_name" text DEFAULT '' NOT NULL,
	"author_photo_url" text,
	"comment" text,
	"comment_original" text,
	"review_created_at" timestamp with time zone,
	"review_updated_at" timestamp with time zone,
	"reply_text" text,
	"reply_source" "review_reply_source",
	"replied_at" timestamp with time zone,
	"draft_text" text,
	"draft_status" "review_draft_status" DEFAULT 'none' NOT NULL,
	"publish_status" "review_publish_status" DEFAULT 'idle' NOT NULL,
	"publish_error" text,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "review_mode" "review_mode" DEFAULT 'accept' NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "review_auto_since" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "review_reply_instructions" text;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "review_signature" text;--> statement-breakpoint
ALTER TABLE "review_sync_runs" ADD CONSTRAINT "review_sync_runs_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "review_sync_runs_profile_started_idx" ON "review_sync_runs" USING btree ("profile_id","started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "review_sync_runs_one_running_idx" ON "review_sync_runs" USING btree ("profile_id") WHERE "review_sync_runs"."status" = 'running';--> statement-breakpoint
CREATE UNIQUE INDEX "reviews_profile_channel_external_idx" ON "reviews" USING btree ("profile_id","channel","external_id");--> statement-breakpoint
CREATE INDEX "reviews_profile_updated_idx" ON "reviews" USING btree ("profile_id","review_updated_at");