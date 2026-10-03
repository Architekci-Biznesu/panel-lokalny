import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { gbpAuditRuns } from "@/lib/db/schema";
import { enqueueGbpAudit } from "@/lib/queue";
import { getActiveProfile, requireOwnedProfile } from "@/lib/session";

/**
 * Starting the listing analysis (request side). The profile is verified here;
 * the work runs in the worker (`runGbpAudit` in audit-run.ts), which gets the
 * run id only. The UI polls the run (AnalysisRunningGate).
 */

/** Creates a `running` run for an owned profile and queues it. Null without a listing. */
export async function enqueueGbpAuditForProfile(
  profileId: string,
): Promise<string | null> {
  const profile = await requireOwnedProfile(profileId);
  if (!profile.gbpLocationId || !profile.oauthConnectionId) {
    return null;
  }

  const [run] = await db
    .insert(gbpAuditRuns)
    .values({ profileId: profile.id, status: "running" })
    .returning({ id: gbpAuditRuns.id });

  try {
    await enqueueGbpAudit(run.id);
  } catch (error) {
    await db
      .update(gbpAuditRuns)
      .set({
        status: "failed",
        error: "Nie udało się zlecić analizy - spróbuj ponownie",
        finishedAt: new Date(),
      })
      .where(eq(gbpAuditRuns.id, run.id));
    throw error;
  }
  return run.id;
}

/** "Przeanalizuj ponownie": queues the analysis of the active (or given owned) profile. */
export async function startGbpAudit(profileId?: string): Promise<{
  ok: boolean;
  error?: string;
}> {
  try {
    const id = profileId ?? (await getActiveProfile()).id;
    const runId = await enqueueGbpAuditForProfile(id);
    if (!runId) {
      return { ok: false, error: "Profil nie ma podłączonej wizytówki Google" };
    }
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "Analiza nie powiodła się",
    };
  }
}

/** Analysis right after connecting the listing (onboarding) - never blocks it. */
export async function scheduleGbpAnalysis(profileId: string): Promise<void> {
  try {
    await enqueueGbpAuditForProfile(profileId);
  } catch (error) {
    console.error("GBP audit enqueue after onboarding failed:", error);
  }
}
