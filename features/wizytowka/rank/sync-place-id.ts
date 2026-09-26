import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { profiles, type Profile } from "@/lib/db/schema";
import {
  getGbpAccessTokenForProfile,
  GbpNotConnectedError,
} from "@/lib/integrations/gbp/access";
import { fetchGbpLocationDetails } from "@/lib/integrations/gbp/client";

function extractPlaceId(raw: Record<string, unknown>): string | null {
  const metadata = raw.metadata;
  if (!metadata || typeof metadata !== "object") return null;
  const placeId = (metadata as Record<string, unknown>).placeId;
  if (typeof placeId === "string" && placeId.trim()) return placeId.trim();
  return null;
}

/**
 * Fetch metadata.placeId from GBP and persist on the profile.
 * Safe to call on wizytówka load or via explicit refresh action.
 */
export async function syncGbpPlaceId(
  profile: Profile,
): Promise<{ placeId: string | null; updated: boolean }> {
  if (!profile.gbpLocationId || !profile.oauthConnectionId) {
    throw new GbpNotConnectedError();
  }

  const accessToken = await getGbpAccessTokenForProfile(profile);
  const raw = await fetchGbpLocationDetails(accessToken, profile.gbpLocationId);
  const placeId = extractPlaceId(raw);

  if (placeId && placeId !== profile.gbpPlaceId) {
    await db
      .update(profiles)
      .set({ gbpPlaceId: placeId })
      .where(
        and(eq(profiles.id, profile.id), eq(profiles.accountId, profile.accountId)),
      );
    return { placeId, updated: true };
  }

  if (!placeId && profile.gbpPlaceId) {
    return { placeId: profile.gbpPlaceId, updated: false };
  }

  return { placeId, updated: false };
}

export async function ensureGbpPlaceId(
  profile: Profile,
): Promise<Profile> {
  if (profile.gbpPlaceId) return profile;
  try {
    const { placeId } = await syncGbpPlaceId(profile);
    if (!placeId) return profile;
    return { ...profile, gbpPlaceId: placeId };
  } catch {
    return profile;
  }
}
