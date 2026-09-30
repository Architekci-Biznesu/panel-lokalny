ALTER TABLE "reviews" ADD COLUMN "draft_edited_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "draft_outdated_at" timestamp with time zone;