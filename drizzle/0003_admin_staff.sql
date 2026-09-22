ALTER TABLE "accounts" ADD COLUMN "last_active_at" timestamp with time zone;-->statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_staff" boolean DEFAULT false NOT NULL;
