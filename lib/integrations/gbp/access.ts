import type { Profile } from "@/lib/db/schema";
import { getActiveProfile } from "@/lib/session";
import { GbpNotConnectedError } from "@/lib/integrations/gbp/errors";

export {
  GbpNotConnectedError,
  isGbpUnauthenticatedError,
} from "@/lib/integrations/gbp/errors";
export { getGbpAccessTokenForProfile } from "@/lib/integrations/gbp/token";

export async function getActiveGbpProfile(): Promise<Profile> {
  const profile = await getActiveProfile();
  if (!profile.gbpLocationId || !profile.oauthConnectionId) {
    throw new GbpNotConnectedError();
  }
  return profile;
}
