CREATE TYPE "public"."review_perspective" AS ENUM('team', 'owner');--> statement-breakpoint
CREATE TYPE "public"."review_style" AS ENUM('warm', 'formal');--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "review_perspective" "review_perspective" DEFAULT 'team' NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "review_style" "review_style" DEFAULT 'warm' NOT NULL;