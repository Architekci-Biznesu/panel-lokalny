import { and, desc, eq } from "drizzle-orm";
import { companyContext, profileBriefs, type Profile } from "@/lib/db/schema";
import type { BriefFields } from "@/lib/ai/types";
import type { ReviewDeps } from "@/features/opinie/review-deps";
import type { GbpLocation } from "@/features/wizytowka/types";

/** What the profile contributes to every reply (brief, ban list, public phone). */
export type ReplyContext = {
  businessName: string;
  brief: BriefFields;
  avoid: string | null;
  /** Public phone from the saved Google profile, for inviting unhappy authors to call */
  phone: string | null;
  instructions: string | null;
  signature: string | null;
};

export async function loadReplyContext(
  profile: Profile,
  deps: Pick<ReviewDeps, "db">,
): Promise<ReplyContext> {
  const { db } = deps;
  const [brief] = await db
    .select()
    .from(profileBriefs)
    .where(eq(profileBriefs.profileId, profile.id))
    .limit(1);

  const [snapshot] = await db
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

  const location = snapshot?.rawData as GbpLocation | null | undefined;
  const phone = location?.phoneNumbers?.primaryPhone?.trim() || null;

  return {
    businessName: profile.name,
    brief: {
      services: brief?.services ?? "",
      tone: brief?.tone ?? "",
      targetAudience: brief?.targetAudience ?? "",
      differentiators: brief?.differentiators ?? "",
    },
    avoid: brief?.avoid ?? null,
    phone,
    instructions: profile.reviewReplyInstructions?.trim() || null,
    signature: profile.reviewSignature?.trim() || null,
  };
}
