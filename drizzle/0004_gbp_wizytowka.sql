CREATE TYPE "public"."gbp_suggestion_field" AS ENUM('title', 'description', 'primary_category', 'additional_categories', 'services');-->statement-breakpoint
CREATE TYPE "public"."gbp_suggestion_risk" AS ENUM('none', 'high');-->statement-breakpoint
CREATE TYPE "public"."gbp_suggestion_status" AS ENUM('pending', 'accepted', 'rejected', 'superseded');-->statement-breakpoint
CREATE TYPE "public"."gbp_audit_run_status" AS ENUM('running', 'done', 'failed');-->statement-breakpoint
CREATE TABLE "gbp_suggestions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"field" "gbp_suggestion_field" NOT NULL,
	"current_value" text,
	"suggested_value" text NOT NULL,
	"rationale" text,
	"risk" "gbp_suggestion_risk" DEFAULT 'none' NOT NULL,
	"status" "gbp_suggestion_status" DEFAULT 'pending' NOT NULL,
	"accepted_at" timestamp with time zone,
	"risk_ack_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);-->statement-breakpoint
CREATE TABLE "gbp_audit_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"status" "gbp_audit_run_status" DEFAULT 'running' NOT NULL,
	"error" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);-->statement-breakpoint
CREATE TABLE "nap_interest_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);-->statement-breakpoint
ALTER TABLE "gbp_suggestions" ADD CONSTRAINT "gbp_suggestions_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;-->statement-breakpoint
ALTER TABLE "gbp_audit_runs" ADD CONSTRAINT "gbp_audit_runs_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;-->statement-breakpoint
ALTER TABLE "nap_interest_requests" ADD CONSTRAINT "nap_interest_requests_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;
