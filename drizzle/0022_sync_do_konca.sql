ALTER TABLE "review_sync_runs" ADD COLUMN "reached_end" boolean DEFAULT false NOT NULL;--> statement-breakpoint
-- Profiles that already hold at least as many reviews as Google reported keep
-- their incremental syncs; the others (e.g. a first import cut at the old
-- 200-page limit) read the whole history once more.
UPDATE "review_sync_runs" AS run SET "reached_end" = true
WHERE run."status" = 'done'
  AND run."total_count" IS NOT NULL
  AND (SELECT count(*) FROM "reviews" r WHERE r."profile_id" = run."profile_id") >= run."total_count";
