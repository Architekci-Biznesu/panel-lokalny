import { eq } from "drizzle-orm";
import { friendlyProviderError } from "@/features/wizytowka/rank/friendly-error";
import { RANK_SCAN_CONCURRENCY } from "@/lib/config/rank-limits";
import { db } from "@/lib/db";
import {
  profiles,
  rankKeywords,
  rankResults,
  rankScans,
} from "@/lib/db/schema";
import { localSearch, mapsSearch } from "@/lib/integrations/scrapingdog";
import {
  cityFromStorefrontAddress,
  formatStorefrontAddress,
} from "@/features/wizytowka/rank/city-from-address";
import { buildRankGrid } from "@/features/wizytowka/rank/grid";
import { matchBusinessInResults } from "@/features/wizytowka/rank/match";
import { computeAgr, computeAtgr } from "@/features/wizytowka/rank/metrics";
import { parseLocation } from "@/features/wizytowka/types";

type LatLng = { latitude: number; longitude: number };

function readLatLng(raw: Record<string, unknown>): LatLng | null {
  const latlng = raw.latlng;
  if (!latlng || typeof latlng !== "object") return null;
  const obj = latlng as Record<string, unknown>;
  const latitude =
    typeof obj.latitude === "number"
      ? obj.latitude
      : typeof obj.lat === "number"
        ? obj.lat
        : null;
  const longitude =
    typeof obj.longitude === "number"
      ? obj.longitude
      : typeof obj.lng === "number"
        ? obj.lng
        : null;
  if (latitude == null || longitude == null) return null;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude };
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function run(): Promise<void> {
    while (next < items.length) {
      const index = next++;
      results[index] = await worker(items[index]);
    }
  }
  const runners = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => run(),
  );
  await Promise.all(runners);
  return results;
}

/**
 * Pure scan runner - no request/session. Safe to call from after() or BullMQ.
 * // TODO: skan cykliczny przez repeatable job (Faza 5)
 */
export async function runScan(scanId: string): Promise<void> {
  const [scan] = await db
    .select()
    .from(rankScans)
    .where(eq(rankScans.id, scanId))
    .limit(1);

  if (!scan) return;
  if (scan.status !== "running") return;

  const [profile] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.id, scan.profileId))
    .limit(1);

  const [keyword] = await db
    .select()
    .from(rankKeywords)
    .where(eq(rankKeywords.id, scan.keywordId))
    .limit(1);

  if (!profile || !keyword) {
    await db
      .update(rankScans)
      .set({
        status: "failed",
        error: "Brak profilu lub frazy",
        finishedAt: new Date(),
      })
      .where(eq(rankScans.id, scanId));
    return;
  }

  if (!profile.gbpPlaceId) {
    await db
      .update(rankScans)
      .set({
        status: "failed",
        error: "Brak place_id wizytówki",
        finishedAt: new Date(),
      })
      .where(eq(rankScans.id, scanId));
    return;
  }

  const { getGbpAccessTokenForProfile } =
    await import("@/lib/integrations/gbp/access");
  const { fetchGbpLocationDetails } =
    await import("@/lib/integrations/gbp/client");

  let raw: Record<string, unknown>;
  try {
    const accessToken = await getGbpAccessTokenForProfile(profile);
    raw = await fetchGbpLocationDetails(accessToken, profile.gbpLocationId!);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Nie udało się pobrać wizytówki";
    await db
      .update(rankScans)
      .set({
        status: "failed",
        error: message,
        finishedAt: new Date(),
      })
      .where(eq(rankScans.id, scanId));
    return;
  }

  const location = parseLocation(raw);
  const latlng = readLatLng(raw);
  if (!latlng) {
    await db
      .update(rankScans)
      .set({
        status: "failed",
        error: "Wizytówka nie ma współrzędnych (latlng)",
        finishedAt: new Date(),
      })
      .where(eq(rankScans.id, scanId));
    return;
  }

  const city = cityFromStorefrontAddress(location.storefrontAddress);
  const businessName = location.title?.trim() || profile.name;
  const businessAddress = formatStorefrontAddress(location.storefrontAddress);
  const placeId = profile.gbpPlaceId;
  const radiusKm = Number(scan.radiusKm);
  const errors: string[] = [];

  let localPackPosition: number | null = null;
  let localPackResults: Array<{
    position: number;
    title: string;
    placeId: string | null;
    rating: number | null;
    reviews: number | null;
    address: string | null;
  }> | null = null;

  if (city) {
    try {
      const localResults = await localSearch({
        query: keyword.phrase,
        city,
        lat: latlng.latitude,
        lng: latlng.longitude,
      });
      localPackResults = localResults.map((r) => ({
        position: r.position,
        title: r.title,
        placeId: r.placeId,
        rating: r.rating,
        reviews: r.reviews,
        address: r.address,
      }));
      const matched = matchBusinessInResults({
        results: localResults,
        placeId,
        businessName,
        businessAddress,
      });
      localPackPosition = matched.position;
    } catch (error) {
      errors.push(
        `Local Pack: ${friendlyProviderError(
          error instanceof Error ? error.message : "błąd",
        )}`,
      );
    }
  } else {
    errors.push("Local Pack: brak miasta w adresie wizytówki");
  }

  const grid = buildRankGrid({
    lat: latlng.latitude,
    lng: latlng.longitude,
    gridSize: scan.gridSize,
    radiusKm,
  });

  const pointOutcomes = await mapPool(
    grid,
    RANK_SCAN_CONCURRENCY,
    async (point) => {
      try {
        const results = await mapsSearch({
          query: keyword.phrase,
          lat: point.lat,
          lng: point.lng,
          zoom: scan.zoom,
        });
        const matched = matchBusinessInResults({
          results,
          placeId,
          businessName,
          businessAddress,
        });
        const row = {
          lat: point.lat,
          lng: point.lng,
          position: matched.position,
          matchMethod: matched.matchMethod,
        };
        await db
          .insert(rankResults)
          .values({ scanId, ...row, checkedAt: new Date() });
        return row;
      } catch (error) {
        errors.push(
          `Siatka: ${friendlyProviderError(
            error instanceof Error ? error.message : "błąd",
          )}`,
        );
        const row = {
          lat: point.lat,
          lng: point.lng,
          position: null as number | null,
          matchMethod: "none" as const,
        };
        await db
          .insert(rankResults)
          .values({ scanId, ...row, checkedAt: new Date() });
        return row;
      }
    },
  );

  const positions = pointOutcomes.map((r) => r.position);
  const agr = computeAgr(positions);
  const atgr = computeAtgr(positions);

  await db
    .update(rankScans)
    .set({
      status: "done",
      localPackPosition,
      localPackResults,
      agr: agr.toFixed(3),
      atgr: atgr.toFixed(4),
      error:
        errors.length > 0 ? [...new Set(errors)].slice(0, 5).join("; ") : null,
      finishedAt: new Date(),
    })
    .where(eq(rankScans.id, scanId));
}
