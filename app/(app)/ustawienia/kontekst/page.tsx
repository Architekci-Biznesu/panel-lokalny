import { eq } from "drizzle-orm";
import { KontekstForm } from "@/features/ustawienia/kontekst-form";
import { db } from "@/lib/db";
import { profileBriefs } from "@/lib/db/schema";
import { getActiveProfile } from "@/lib/session";

export default async function KontekstPage() {
  const profile = await getActiveProfile();
  const [brief] = await db
    .select()
    .from(profileBriefs)
    .where(eq(profileBriefs.profileId, profile.id))
    .limit(1);

  return (
    <div className="ui-section">
      <h2 className="text-lg font-semibold">Kontekst firmy</h2>
      <p className="mt-1 mb-4 text-sm text-muted-foreground">
        Brief steruje propozycjami AI w wizytówce i kolejnych modułach.
      </p>
      <KontekstForm
        hasGbp={Boolean(profile.gbpLocationId)}
        initial={{
          services: brief?.services ?? "",
          tone: brief?.tone ?? "",
          targetAudience: brief?.targetAudience ?? "",
          differentiators: brief?.differentiators ?? "",
          serviceArea: brief?.serviceArea ?? "",
          avoid: brief?.avoid ?? "",
          outOfScope: brief?.outOfScope ?? "",
          websiteUrl: brief?.websiteUrl ?? "",
          notes: brief?.notes ?? "",
        }}
      />
    </div>
  );
}
