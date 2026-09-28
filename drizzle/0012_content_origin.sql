CREATE TYPE "public"."content_origin" AS ENUM('ai', 'manual');--> statement-breakpoint
ALTER TABLE "content_items" ADD COLUMN "origin" "content_origin" DEFAULT 'ai' NOT NULL;