"use server";

import { and, eq } from "drizzle-orm";
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  RANK_GRID_SIZE,
  RANK_MAX_KEYWORDS,
  RANK_RADIUS_OPTIONS_KM,
  RANK_ZOOM,
  rankQueryCount,
} from "@/lib/config/rank-limits";
import { db } from "@/lib/db";
import {
  rankKeywords,
  rankResults,
  rankScans,
  type RankResult,
  type RankScan,
} from "@/lib/db/schema";
import { getActiveGbpProfile } from "@/lib/integrations/gbp/access";
import {
  hasDoneScanTodayForKeyword,
  hasRunningScanForKeyword,
  markStaleRunningScans,
  syncGbpPlaceId,
} from "@/features/wizytowka/rank";
import { runScan } from "@/features/wizytowka/rank/run-scan";

type ActionFail = { ok: false; error: string };

function fail(error: unknown): ActionFail {
  return {
    ok: false,
    error:
      error instanceof Error ? error.message : "Nie udało się wykonać akcji",
  };
}

const phraseSchema = z.object({
  phrase: z.string().trim().min(2).max(120),
  radiusKm: z.coerce
    .number()
    .refine(
      (v): v is (typeof RANK_RADIUS_OPTIONS_KM)[number] =>
        (RANK_RADIUS_OPTIONS_KM as readonly number[]).includes(v),
      "Nieprawidłowy zasięg",
    )
    .default(10),
});

const keywordIdSchema = z.object({
  keywordId: z.string().uuid(),
});

const startScanSchema = z.object({
  keywordId: z.string().uuid(),
  radiusKm: z.coerce
    .number()
    .refine(
      (v): v is (typeof RANK_RADIUS_OPTIONS_KM)[number] =>
        (RANK_RADIUS_OPTIONS_KM as readonly number[]).includes(v),
      "Nieprawidłowy zasięg",
    ),
});

const scanIdSchema = z.object({
  scanId: z.string().uuid(),
});

export async function addRankKeyword(input: unknown): Promise<
  | {
      ok: true;
      keyword: {
        id: string;
        phrase: string;
        defaultRadiusKm: number;
        createdAt: string;
      };
    }
  | ActionFail
> {
  const parsed = phraseSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Podaj frazę (2-120 znaków)" };
  }

  try {
    const profile = await getActiveGbpProfile();
    const existing = await db
      .select({ id: rankKeywords.id })
      .from(rankKeywords)
      .where(eq(rankKeywords.profileId, profile.id));

    if (existing.length >= RANK_MAX_KEYWORDS) {
      return {
        ok: false,
        error: `Limit ${RANK_MAX_KEYWORDS} fraz na profil został osiągnięty`,
      };
    }

    const phrase = parsed.data.phrase;
    const duplicate = existing.length
      ? await db
          .select({ id: rankKeywords.id, phrase: rankKeywords.phrase })
          .from(rankKeywords)
          .where(eq(rankKeywords.profileId, profile.id))
      : [];
    if (
      duplicate.some((row) => row.phrase.toLowerCase() === phrase.toLowerCase())
    ) {
      return { ok: false, error: "Ta fraza jest już na liście" };
    }

    const [created] = await db
      .insert(rankKeywords)
      .values({
        profileId: profile.id,
        phrase,
        defaultRadiusKm: String(parsed.data.radiusKm),
      })
      .returning();

    revalidatePath("/wizytowka/raporty");
    return {
      ok: true,
      keyword: {
        id: created.id,
        phrase: created.phrase,
        defaultRadiusKm: Number(created.defaultRadiusKm),
        createdAt: created.createdAt.toISOString(),
      },
    };
  } catch (error) {
    return fail(error);
  }
}

export async function removeRankKeyword(
  input: unknown,
): Promise<{ ok: true } | ActionFail> {
  const parsed = keywordIdSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Nieprawidłowa fraza" };
  }

  try {
    const profile = await getActiveGbpProfile();
    const deleted = await db
      .delete(rankKeywords)
      .where(
        and(
          eq(rankKeywords.id, parsed.data.keywordId),
          eq(rankKeywords.profileId, profile.id),
        ),
      )
      .returning({ id: rankKeywords.id });

    if (deleted.length === 0) {
      return { ok: false, error: "Nie znaleziono frazy" };
    }
    revalidatePath("/wizytowka/raporty");
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function startRankScan(
  input: unknown,
): Promise<
  | { ok: true; scanId: string; queryCount: number }
  | { ok: false; error: string }
> {
  const parsed = startScanSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Nieprawidłowe parametry skanu" };
  }

  try {
    const profile = await getActiveGbpProfile();
    await markStaleRunningScans(profile.id);

    if (!profile.gbpPlaceId) {
      return {
        ok: false,
        error:
          "Nie można zidentyfikować wizytówki w wynikach - pobierz ponownie dane z Google",
      };
    }

    const [keyword] = await db
      .select()
      .from(rankKeywords)
      .where(
        and(
          eq(rankKeywords.id, parsed.data.keywordId),
          eq(rankKeywords.profileId, profile.id),
        ),
      )
      .limit(1);

    if (!keyword) {
      return { ok: false, error: "Nie znaleziono frazy" };
    }

    if (await hasRunningScanForKeyword(profile.id, keyword.id)) {
      return { ok: false, error: "Skan tej frazy już trwa" };
    }

    if (await hasDoneScanTodayForKeyword(profile.id, keyword.id)) {
      return {
        ok: false,
        error:
          "Dziś już wykonano skan tej frazy - kolejny będzie dostępny jutro",
      };
    }

    await db
      .update(rankKeywords)
      .set({ defaultRadiusKm: String(parsed.data.radiusKm) })
      .where(
        and(
          eq(rankKeywords.id, keyword.id),
          eq(rankKeywords.profileId, profile.id),
        ),
      );

    const [created] = await db
      .insert(rankScans)
      .values({
        profileId: profile.id,
        keywordId: keyword.id,
        gridSize: RANK_GRID_SIZE,
        radiusKm: String(parsed.data.radiusKm),
        zoom: RANK_ZOOM,
        status: "running",
      })
      .returning({ id: rankScans.id });

    const scanId = created.id;
    after(() => {
      void runScan(scanId);
    });

    revalidatePath("/wizytowka/raporty");
    return {
      ok: true,
      scanId,
      queryCount: rankQueryCount(RANK_GRID_SIZE),
    };
  } catch (error) {
    return fail(error);
  }
}

export async function getRankScanStatus(input: unknown): Promise<
  | {
      ok: true;
      scan: Pick<
        RankScan,
        | "id"
        | "status"
        | "error"
        | "agr"
        | "atgr"
        | "localPackPosition"
        | "localPackResults"
        | "finishedAt"
        | "startedAt"
        | "gridSize"
        | "radiusKm"
        | "zoom"
        | "keywordId"
      >;
      results: Array<
        Pick<RankResult, "lat" | "lng" | "position" | "matchMethod">
      >;
    }
  | { ok: false; error: string }
> {
  const parsed = scanIdSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Nieprawidłowy skan" };
  }

  try {
    const profile = await getActiveGbpProfile();
    await markStaleRunningScans(profile.id);

    const [scan] = await db
      .select()
      .from(rankScans)
      .where(
        and(
          eq(rankScans.id, parsed.data.scanId),
          eq(rankScans.profileId, profile.id),
        ),
      )
      .limit(1);

    if (!scan) {
      return { ok: false, error: "Nie znaleziono skanu" };
    }

    const results = await db
      .select({
        lat: rankResults.lat,
        lng: rankResults.lng,
        position: rankResults.position,
        matchMethod: rankResults.matchMethod,
      })
      .from(rankResults)
      .where(eq(rankResults.scanId, scan.id));

    return {
      ok: true,
      scan: {
        id: scan.id,
        status: scan.status,
        error: scan.error,
        agr: scan.agr,
        atgr: scan.atgr,
        localPackPosition: scan.localPackPosition,
        localPackResults: scan.localPackResults,
        finishedAt: scan.finishedAt,
        startedAt: scan.startedAt,
        gridSize: scan.gridSize,
        radiusKm: scan.radiusKm,
        zoom: scan.zoom,
        keywordId: scan.keywordId,
      },
      results,
    };
  } catch (error) {
    return fail(error);
  }
}

export async function refreshGbpPlaceIdAction(): Promise<
  ({ ok: true; placeId?: string | null } | ActionFail) & {
    placeId?: string | null;
  }
> {
  try {
    const profile = await getActiveGbpProfile();
    const { placeId } = await syncGbpPlaceId(profile);
    revalidatePath("/wizytowka/raporty");
    if (!placeId) {
      return {
        ok: false,
        error:
          "Google nie zwróciło place_id - nie można zidentyfikować wizytówki w wynikach",
        placeId: null,
      };
    }
    return { ok: true, placeId };
  } catch (error) {
    return fail(error);
  }
}

const suggestedPhraseSchema = z.object({
  phrase: z.string().trim().min(2).max(120),
});

/** Akceptacja propozycji: phrase = oryginał z analizy, finalPhrase = tekst po edycji, radiusKm = zasięg. */
const acceptSuggestedSchema = suggestedPhraseSchema.extend({
  finalPhrase: z.string().trim().min(2).max(120).optional(),
  radiusKm: phraseSchema.shape.radiusKm.optional(),
});

/** Accept a suggested rank phrase from audit (adds keyword, removes from suggestions). */
export async function acceptSuggestedRankPhrase(input: unknown): Promise<
  | {
      ok: true;
      keyword: {
        id: string;
        phrase: string;
        defaultRadiusKm: number;
        createdAt: string;
      };
    }
  | ActionFail
> {
  const parsed = acceptSuggestedSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Nieprawidłowa fraza" };
  }

  try {
    const profile = await getActiveGbpProfile();
    const { loadLatestAuditInsights, updateAuditSuggestedRankPhrases } =
      await import("@/features/wizytowka/competitor-insights");

    const loaded = await loadLatestAuditInsights(profile.id);
    const phrase = parsed.data.phrase;
    const finalPhrase = parsed.data.finalPhrase ?? phrase;
    const suggested = loaded?.insights.suggestedRankPhrases ?? [];
    if (!suggested.some((p) => p.toLowerCase() === phrase.toLowerCase())) {
      return { ok: false, error: "Ta propozycja już nie istnieje" };
    }

    const existing = await db
      .select({ id: rankKeywords.id })
      .from(rankKeywords)
      .where(eq(rankKeywords.profileId, profile.id));

    if (existing.length >= RANK_MAX_KEYWORDS) {
      return {
        ok: false,
        error: `Limit ${RANK_MAX_KEYWORDS} fraz na profil został osiągnięty`,
      };
    }

    const duplicate = await db
      .select({ id: rankKeywords.id, phrase: rankKeywords.phrase })
      .from(rankKeywords)
      .where(eq(rankKeywords.profileId, profile.id));
    if (
      duplicate.some(
        (row) => row.phrase.toLowerCase() === finalPhrase.toLowerCase(),
      )
    ) {
      await updateAuditSuggestedRankPhrases(
        profile.id,
        suggested.filter((p) => p.toLowerCase() !== phrase.toLowerCase()),
      );
      return { ok: false, error: "Ta fraza jest już na liście" };
    }

    const [created] = await db
      .insert(rankKeywords)
      .values({
        profileId: profile.id,
        phrase: finalPhrase,
        defaultRadiusKm: String(parsed.data.radiusKm ?? 10),
      })
      .returning();

    await updateAuditSuggestedRankPhrases(
      profile.id,
      suggested.filter((p) => p.toLowerCase() !== phrase.toLowerCase()),
    );

    revalidatePath("/wizytowka/raporty");
    return {
      ok: true,
      keyword: {
        id: created.id,
        phrase: created.phrase,
        defaultRadiusKm: Number(created.defaultRadiusKm),
        createdAt: created.createdAt.toISOString(),
      },
    };
  } catch (error) {
    return fail(error);
  }
}

/** Dismiss a suggested rank phrase without adding it. */
export async function dismissSuggestedRankPhrase(
  input: unknown,
): Promise<{ ok: true } | ActionFail> {
  const parsed = suggestedPhraseSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Nieprawidłowa fraza" };
  }

  try {
    const profile = await getActiveGbpProfile();
    const { loadLatestAuditInsights, updateAuditSuggestedRankPhrases } =
      await import("@/features/wizytowka/competitor-insights");

    const loaded = await loadLatestAuditInsights(profile.id);
    if (!loaded) return { ok: true };

    const phrase = parsed.data.phrase;
    const next = loaded.insights.suggestedRankPhrases.filter(
      (p) => p.toLowerCase() !== phrase.toLowerCase(),
    );
    await updateAuditSuggestedRankPhrases(profile.id, next);
    revalidatePath("/wizytowka/raporty");
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}
