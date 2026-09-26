ALTER TABLE "rank_keywords" ADD COLUMN "default_radius_km" numeric(6, 2) DEFAULT '10' NOT NULL;-->statement-breakpoint
ALTER TABLE "rank_scans" ADD COLUMN "local_pack_results" jsonb;
