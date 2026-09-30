/**
 * How long data read from Google counts as fresh - pages show a snapshot
 * younger than this without asking Google. Older snapshots are still shown
 * at once and refreshed in the background. Keep out of UI components.
 */

import type { GbpSnapshotKind } from "@/lib/db/schema";

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export const GBP_FRESHNESS_MS: Record<GbpSnapshotKind, number> = {
  /** Name, description, categories, hours, contact, services, attributes - most changes come from the panel itself. */
  location: 10 * MINUTE,
  media: 6 * HOUR,
  /** Google updates Performance once a day, 2-3 days late - asking more often gives nothing newer. */
  metrics: 12 * HOUR,
  /** Public PL dictionary, shared by all profiles. */
  categories: 7 * DAY,
  /** Public per-category dictionary, shared by all profiles. */
  attribute_metadata: 7 * DAY,
};

/** A refresh that started longer ago than this is treated as dead - another request may take over. */
export const GBP_REFRESH_LOCK_MS = 2 * MINUTE;
