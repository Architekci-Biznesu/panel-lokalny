/**
 * One-off: stores the v4 location name (accounts/{a}/locations/{l}) for
 * profiles connected before Faza 6b. Safe to run again - profiles that
 * already have it are skipped, and a failed profile is only logged (the panel
 * finds the name itself on first use anyway).
 *
 *   npx --yes tsx scripts/backfill-gbp-v4-names.ts
 */

async function main() {
  const { config } = await import("dotenv");
  config({ path: ".env.local", quiet: true });

  const { and, isNotNull, isNull } = await import("drizzle-orm");
  const { db } = await import("../lib/db");
  const { profiles } = await import("../lib/db/schema");
  const { getGbpAccessTokenForProfile } =
    await import("../lib/integrations/gbp/token");
  const { withGbpV4LocationName } =
    await import("../lib/integrations/gbp/v4-name");

  const pending = await db
    .select()
    .from(profiles)
    .where(
      and(
        isNotNull(profiles.gbpLocationId),
        isNotNull(profiles.oauthConnectionId),
        isNull(profiles.gbpV4LocationName),
      ),
    );

  console.log(`Profile bez nazwy v4: ${pending.length}`);
  let done = 0;
  for (const profile of pending) {
    try {
      const token = await getGbpAccessTokenForProfile(profile);
      const name = await withGbpV4LocationName(
        profile,
        token,
        async (v4) => v4,
      );
      console.log(`  ${profile.name}: ${name}`);
      done += 1;
    } catch (error) {
      console.error(
        `  ${profile.name}: nie udało się -`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  console.log(`Uzupełniono: ${done} z ${pending.length}`);
  await db.$client.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
