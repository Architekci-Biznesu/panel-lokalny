"use server";

import { z } from "zod";
import { getActiveGbpProfile } from "@/lib/integrations/gbp/access";
import {
  getGbpDataStatus,
  PULPIT_SNAPSHOT_KINDS,
  requestGbpDataRefresh,
  WIZYTOWKA_SNAPSHOT_KINDS,
} from "@/features/wizytowka/snapshots/read";

const scopeSchema = z.object({ scope: z.enum(["wizytowka", "pulpit"]) });

function kindsFor(scope: "wizytowka" | "pulpit") {
  return scope === "pulpit" ? PULPIT_SNAPSHOT_KINDS : WIZYTOWKA_SNAPSHOT_KINDS;
}

export type GbpDataStatusResult =
  | { ok: true; fetchedAt: string | null; refreshing: boolean }
  | { ok: false; error: string };

/** Light status for polling while a background refresh runs. */
export async function getGbpDataStatusAction(
  input: unknown,
): Promise<GbpDataStatusResult> {
  const parsed = scopeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Nieprawidłowe dane" };
  try {
    const profile = await getActiveGbpProfile();
    const status = await getGbpDataStatus(profile, kindsFor(parsed.data.scope));
    return {
      ok: true,
      fetchedAt: status.fetchedAt?.toISOString() ?? null,
      refreshing: status.refreshing,
    };
  } catch {
    return { ok: false, error: "Nie udało się sprawdzić danych z Google" };
  }
}

/** "Odśwież z Google" - refreshes the screen's data now, whatever its age. */
export async function refreshGbpDataAction(
  input: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = scopeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Nieprawidłowe dane" };
  try {
    const profile = await getActiveGbpProfile();
    await requestGbpDataRefresh(profile, kindsFor(parsed.data.scope));
    return { ok: true };
  } catch {
    return { ok: false, error: "Nie udało się odświeżyć danych z Google" };
  }
}
