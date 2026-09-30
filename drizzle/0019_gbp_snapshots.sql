CREATE TYPE "public"."gbp_snapshot_kind" AS ENUM('location', 'media', 'metrics', 'categories', 'attribute_metadata');--> statement-breakpoint
CREATE TABLE "gbp_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid,
	"kind" "gbp_snapshot_kind" NOT NULL,
	"key" text NOT NULL,
	"data" jsonb NOT NULL,
	"fetched_at" timestamp with time zone NOT NULL,
	"refreshing_since" timestamp with time zone,
	CONSTRAINT "gbp_snapshots_profile_kind_key_uq" UNIQUE NULLS NOT DISTINCT("profile_id","kind","key")
);
--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "gbp_v4_location_name" text;--> statement-breakpoint
ALTER TABLE "gbp_snapshots" ADD CONSTRAINT "gbp_snapshots_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;