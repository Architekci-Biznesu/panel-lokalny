ALTER TABLE "profiles" ADD COLUMN "gbp_place_id" text;-->statement-breakpoint
CREATE TYPE "public"."rank_scan_status" AS ENUM('running', 'done', 'failed');-->statement-breakpoint
CREATE TYPE "public"."rank_match_method" AS ENUM('place_id', 'name_fallback', 'none');-->statement-breakpoint
CREATE TABLE "rank_keywords" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"phrase" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);-->statement-breakpoint
CREATE TABLE "rank_scans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"keyword_id" uuid NOT NULL,
	"grid_size" integer NOT NULL,
	"radius_km" numeric(6, 2) NOT NULL,
	"zoom" integer DEFAULT 14 NOT NULL,
	"status" "rank_scan_status" DEFAULT 'running' NOT NULL,
	"error" text,
	"local_pack_position" integer,
	"agr" numeric(8, 3),
	"atgr" numeric(8, 4),
	"share_token" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);-->statement-breakpoint
CREATE TABLE "rank_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scan_id" uuid NOT NULL,
	"lat" double precision NOT NULL,
	"lng" double precision NOT NULL,
	"position" integer,
	"match_method" "rank_match_method" NOT NULL,
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL
);-->statement-breakpoint
ALTER TABLE "rank_keywords" ADD CONSTRAINT "rank_keywords_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;-->statement-breakpoint
ALTER TABLE "rank_scans" ADD CONSTRAINT "rank_scans_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;-->statement-breakpoint
ALTER TABLE "rank_scans" ADD CONSTRAINT "rank_scans_keyword_id_rank_keywords_id_fk" FOREIGN KEY ("keyword_id") REFERENCES "public"."rank_keywords"("id") ON DELETE cascade ON UPDATE no action;-->statement-breakpoint
ALTER TABLE "rank_results" ADD CONSTRAINT "rank_results_scan_id_rank_scans_id_fk" FOREIGN KEY ("scan_id") REFERENCES "public"."rank_scans"("id") ON DELETE cascade ON UPDATE no action;-->statement-breakpoint
CREATE INDEX "rank_keywords_profile_id_idx" ON "rank_keywords" USING btree ("profile_id");-->statement-breakpoint
CREATE INDEX "rank_scans_profile_id_idx" ON "rank_scans" USING btree ("profile_id");-->statement-breakpoint
CREATE INDEX "rank_scans_keyword_id_idx" ON "rank_scans" USING btree ("keyword_id");-->statement-breakpoint
CREATE UNIQUE INDEX "rank_scans_share_token_uidx" ON "rank_scans" USING btree ("share_token");-->statement-breakpoint
CREATE INDEX "rank_results_scan_id_idx" ON "rank_results" USING btree ("scan_id");
