CREATE TYPE "public"."content_generation_kind" AS ENUM('posts', 'topics');--> statement-breakpoint
CREATE TYPE "public"."content_topic_status" AS ENUM('open', 'used', 'dismissed');--> statement-breakpoint
CREATE TABLE "content_topics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"group_id" uuid,
	"title" text NOT NULL,
	"origin" "content_origin" DEFAULT 'ai' NOT NULL,
	"status" "content_topic_status" DEFAULT 'open' NOT NULL,
	"content_item_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"used_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "content_generation_runs" ADD COLUMN "kind" "content_generation_kind" DEFAULT 'posts' NOT NULL;--> statement-breakpoint
ALTER TABLE "content_generation_runs" ADD COLUMN "topic_ids" jsonb;--> statement-breakpoint
ALTER TABLE "content_topics" ADD CONSTRAINT "content_topics_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_topics" ADD CONSTRAINT "content_topics_group_id_publish_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."publish_groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_topics" ADD CONSTRAINT "content_topics_content_item_id_content_items_id_fk" FOREIGN KEY ("content_item_id") REFERENCES "public"."content_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "content_topics_profile_id_idx" ON "content_topics" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX "content_topics_group_id_idx" ON "content_topics" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "content_topics_status_idx" ON "content_topics" USING btree ("status");