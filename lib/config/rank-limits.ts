/** Rank scan limits - keep out of UI components. */

export const RANK_MAX_KEYWORDS = 10;

export const RANK_GRID_SIZE = 5;

export const RANK_ZOOM = 14;

export const RANK_RADIUS_OPTIONS_KM = [5, 10, 15] as const;

export type RankRadiusKm = (typeof RANK_RADIUS_OPTIONS_KM)[number];

export const RANK_TIMEZONE = "Europe/Warsaw";

/** Stale running scans older than this are treated as failed. */
export const RANK_STALE_RUNNING_MS = 15 * 60 * 1000;

/** Max parallel ScrapingDog map point requests. */
export const RANK_SCAN_CONCURRENCY = 5;

/** Outside top-20 counts as this for AGR. */
export const RANK_MISSING_POSITION = 21;

export function rankQueryCount(gridSize: number = RANK_GRID_SIZE): number {
  return gridSize * gridSize + 1;
}
