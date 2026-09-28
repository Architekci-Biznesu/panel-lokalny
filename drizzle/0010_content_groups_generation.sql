CREATE TYPE "public"."content_generation_status" AS ENUM('running', 'done', 'failed');--> statement-breakpoint
CREATE TABLE "content_generation_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"group_id" uuid,
	"status" "content_generation_status" DEFAULT 'running' NOT NULL,
	"requested" integer NOT NULL,
	"created" integer DEFAULT 0 NOT NULL,
	"with_image" integer DEFAULT 0 NOT NULL,
	"request" text,
	"error" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "content_items" ADD COLUMN "group_id" uuid;--> statement-breakpoint
ALTER TABLE "content_generation_runs" ADD CONSTRAINT "content_generation_runs_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_generation_runs" ADD CONSTRAINT "content_generation_runs_group_id_publish_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."publish_groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "content_generation_runs_profile_id_idx" ON "content_generation_runs" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX "content_generation_runs_group_id_idx" ON "content_generation_runs" USING btree ("group_id");--> statement-breakpoint
ALTER TABLE "content_items" ADD CONSTRAINT "content_items_group_id_publish_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."publish_groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "content_items_group_id_idx" ON "content_items" USING btree ("group_id");