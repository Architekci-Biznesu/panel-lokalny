CREATE TYPE "public"."rank_scan_trigger" AS ENUM('manual', 'auto');--> statement-breakpoint
ALTER TYPE "public"."content_target_status" ADD VALUE 'publishing' BEFORE 'published';--> statement-breakpoint
ALTER TABLE "content_targets" ADD COLUMN "claimed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "rank_scans" ADD COLUMN "trigger" "rank_scan_trigger" DEFAULT 'manual' NOT NULL;--> statement-breakpoint
CREATE INDEX "content_generation_runs_status_idx" ON "content_generation_runs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "gbp_audit_runs_status_idx" ON "gbp_audit_runs" USING btree ("status");