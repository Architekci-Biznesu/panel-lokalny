import { and, desc, eq } from "drizzle-orm";
import type { ContentContext } from "@/lib/ai";
import { db } from "@/lib/db";
import {
  companyContext,
  contentItems,
  profileBriefs,
  type Profile,
} from "@/lib/db/schema";
import { extractGbpSnapshot } from "@/features/publikacje/gbp-snapshot";
import { loadContentScope, ownedByScope } from "@/features/publikacje/scope";

/** How many recent titles the AI sees so it does not repeat a topic. */
const RECENT_TITLES_LIMIT = 10;

/**
 * Builds the AI context for one profile. Caller must have verified that the
 * profile belongs to the active account (getActiveProfile / requireOwnedProfile).
 */
export async function loadContentContext(
  profile: Profile,
): Promise<ContentContext> {
  const [brief] = await db
    .select()
    .from(profileBriefs)
    .where(eq(profileBriefs.profileId, profile.id))
    .limit(1);

  const [snapshotRow] = await db
    .select({ rawData: companyContext.rawData })
    .from(companyContext)
    .where(
      and(
        eq(companyContext.profileId, profile.id),
        eq(companyContext.source, "gbp"),
      ),
    )
    .orderBy(desc(companyContext.fetchedAt))
    .limit(1);

  // Group posts count too - the group shares one list, so no repeats across it.
  const scope = await loadContentScope(profile);
  const recent = await db
    .select({ title: contentItems.title })
    .from(contentItems)
    .where(ownedByScope(scope))
    .orderBy(desc(contentItems.createdAt))
    .limit(RECENT_TITLES_LIMIT);

  const snapshot = extractGbpSnapshot(snapshotRow?.rawData);

  return {
    businessName: profile.name,
    brief: {
      services: brief?.services ?? "",
      tone: brief?.tone ?? "",
      targetAudience: brief?.targetAudience ?? "",
      differentiators: brief?.differentiators ?? "",
    },
    serviceArea: brief?.serviceArea ?? null,
    avoid: brief?.avoid ?? null,
    outOfScope: brief?.outOfScope ?? null,
    categories: snapshot.categories,
    services: snapshot.services,
    recentTitles: recent.map((row) => row.title),
  };
}
