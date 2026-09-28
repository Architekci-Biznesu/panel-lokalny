import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { profileBriefs } from "@/lib/db/schema";
import { mergeAvoid } from "@/lib/brief-avoid";

/**
 * Appends a rejection reason to profile_briefs.avoid - AI prompts treat it as a
 * hard ban. Caller must have verified that profileId belongs to the active account.
 */
export async function appendBriefAvoid(
  profileId: string,
  reason: string | null | undefined,
): Promise<void> {
  const trimmed = reason?.trim();
  if (!trimmed) return;

  const [brief] = await db
    .select()
    .from(profileBriefs)
    .where(eq(profileBriefs.profileId, profileId))
    .limit(1);
  if (!brief) return;

  await db
    .update(profileBriefs)
    .set({ avoid: mergeAvoid(brief.avoid, trimmed), updatedAt: new Date() })
    .where(eq(profileBriefs.id, brief.id));
}
