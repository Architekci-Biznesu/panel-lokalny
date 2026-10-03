import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { profiles, type Profile } from "@/lib/db/schema";
import { resolveGbpV4LocationName } from "@/lib/integrations/gbp/client";
import {
  GBP_V4_NOT_FOUND_MESSAGE,
  isGbpNotFoundError,
} from "@/lib/integrations/gbp/errors";

/**
 * v4 APIs (photos, posts, reviews) need `accounts/{a}/locations/{l}`. Finding
 * the account costs a list of accounts plus one probe per account, and the
 * answer never changes - so it is found once and kept in the profile.
 * No session and no next/* here - background jobs use it too.
 */

export { GBP_V4_NOT_FOUND_MESSAGE } from "@/lib/integrations/gbp/errors";

function locationIdOf(locationName: string): string {
  return locationName.replace(/^locations\//, "");
}

/** Stored name only if it still points at the profile's current location. */
function storedV4Name(profile: Profile): string | null {
  const stored = profile.gbpV4LocationName;
  if (!stored || !profile.gbpLocationId) return null;
  return stored.endsWith(`/locations/${locationIdOf(profile.gbpLocationId)}`)
    ? stored
    : null;
}

/** Asks Google which account owns the location and saves the answer. */
async function resolveAndStore(
  profile: Profile,
  accessToken: string,
): Promise<string> {
  const locationName = profile.gbpLocationId ?? "";
  const resolved = await resolveGbpV4LocationName(accessToken, locationName);
  if (!resolved) {
    throw new Error(`GBP v4 location: ${GBP_V4_NOT_FOUND_MESSAGE}`);
  }
  await db
    .update(profiles)
    .set({ gbpV4LocationName: resolved })
    .where(
      and(
        eq(profiles.id, profile.id),
        eq(profiles.gbpLocationId, locationName),
      ),
    );
  profile.gbpV4LocationName = resolved;
  return resolved;
}

/**
 * Runs `call` with the profile's v4 location name. Uses the stored name; finds
 * it (and stores it) when missing, or again once when Google answers 404 for
 * the stored one - the location may have moved to another account.
 */
export async function withGbpV4LocationName<T>(
  profile: Profile,
  accessToken: string,
  call: (v4LocationName: string) => Promise<T>,
): Promise<T> {
  const stored = storedV4Name(profile);
  if (!stored) return call(await resolveAndStore(profile, accessToken));

  try {
    return await call(stored);
  } catch (error) {
    if (!isGbpNotFoundError(error)) throw error;
    const fresh = await resolveAndStore(profile, accessToken);
    if (fresh === stored) throw error;
    return call(fresh);
  }
}
