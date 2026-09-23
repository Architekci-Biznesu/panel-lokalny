import { eq } from "drizzle-orm";
import { NapView } from "@/features/wizytowka/components/nap-view";
import { db } from "@/lib/db";
import { napInterestRequests } from "@/lib/db/schema";
import { getActiveProfile } from "@/lib/session";

export default async function NapPage() {
  const profile = await getActiveProfile();
  const rows = await db
    .select()
    .from(napInterestRequests)
    .where(eq(napInterestRequests.profileId, profile.id));

  return <NapView requestsCount={rows.length} />;
}
