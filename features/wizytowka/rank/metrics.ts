import { RANK_MISSING_POSITION } from "@/lib/config/rank-limits";

/**
 * AGR = average grid rank. Missing (null) positions count as 21, never skipped.
 */
export function computeAgr(positions: Array<number | null>): number {
  if (positions.length === 0) return RANK_MISSING_POSITION;
  let sum = 0;
  for (const pos of positions) {
    sum += pos == null ? RANK_MISSING_POSITION : pos;
  }
  return sum / positions.length;
}

/**
 * ATGR = share of grid points in top 3.
 */
export function computeAtgr(positions: Array<number | null>): number {
  if (positions.length === 0) return 0;
  const top3 = positions.filter((pos) => pos != null && pos <= 3).length;
  return top3 / positions.length;
}
