ALTER TABLE "onboarding_drafts" ADD COLUMN "profile_name" text;-->statement-breakpoint
ALTER TABLE "onboarding_drafts" ADD COLUMN "website_scrape" jsonb;-->statement-breakpoint
UPDATE "onboarding_drafts" AS d
SET "profile_name" = p."name"
FROM "profiles" AS p
WHERE d."profile_id" = p."id"
  AND p."gbp_location_id" IS NULL
  AND d."profile_name" IS NULL;-->statement-breakpoint
UPDATE "onboarding_drafts" AS d
SET "website_scrape" = sub."raw_data"
FROM (
  SELECT DISTINCT ON ("profile_id") "profile_id", "raw_data"
  FROM "company_context"
  WHERE "source" = 'website'
  ORDER BY "profile_id", "fetched_at" DESC
) AS sub
WHERE d."profile_id" = sub."profile_id"
  AND d."website_scrape" IS NULL;-->statement-breakpoint
DELETE FROM "profiles" AS p
USING "onboarding_drafts" AS d
WHERE d."profile_id" = p."id"
  AND p."gbp_location_id" IS NULL;
