CREATE TYPE "public"."content_channel" AS ENUM('gbp', 'facebook', 'instagram');--> statement-breakpoint
CREATE TYPE "public"."content_status" AS ENUM('draft', 'pending', 'accepted', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."content_target_status" AS ENUM('queued', 'scheduled', 'published', 'failed');--> statement-breakpoint
CREATE TYPE "public"."content_type" AS ENUM('post', 'blog');--> statement-breakpoint
CREATE TABLE "content_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"type" "content_type" DEFAULT 'post' NOT NULL,
	"status" "content_status" DEFAULT 'pending' NOT NULL,
	"topic" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"image_url" text,
	"image_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "content_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content_item_id" uuid NOT NULL,
	"body" text NOT NULL,
	"image_url" text,
	"instruction" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "content_targets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content_item_id" uuid NOT NULL,
	"profile_id" uuid NOT NULL,
	"channel" "content_channel" NOT NULL,
	"status" "content_target_status" DEFAULT 'queued' NOT NULL,
	"scheduled_at" timestamp with time zone,
	"published_at" timestamp with time zone,
	"external_id" text,
	"error" text
);--> statement-breakpoint
ALTER TABLE "content_items" ADD CONSTRAINT "content_items_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_revisions" ADD CONSTRAINT "content_revisions_content_item_id_content_items_id_fk" FOREIGN KEY ("content_item_id") REFERENCES "public"."content_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_targets" ADD CONSTRAINT "content_targets_content_item_id_content_items_id_fk" FOREIGN KEY ("content_item_id") REFERENCES "public"."content_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_targets" ADD CONSTRAINT "content_targets_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "content_items_profile_id_idx" ON "content_items" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX "content_items_status_idx" ON "content_items" USING btree ("status");--> statement-breakpoint
CREATE INDEX "content_revisions_content_item_id_idx" ON "content_revisions" USING btree ("content_item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "content_targets_item_profile_channel_uidx" ON "content_targets" USING btree ("content_item_id","profile_id","channel");--> statement-breakpoint
CREATE INDEX "content_targets_profile_id_idx" ON "content_targets" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX "content_targets_status_idx" ON "content_targets" USING btree ("status");--> statement-breakpoint
CREATE INDEX "content_targets_scheduled_at_idx" ON "content_targets" USING btree ("scheduled_at");
