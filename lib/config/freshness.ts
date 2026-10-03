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

/**
 * Refresh ahead of the customer's visit (worker, profiles active in the last
 * days below). Not a chase of GBP_FRESHNESS_MS - it only keeps the first
 * visit from showing data many hours old. The visit itself still refreshes a
 * stale snapshot in the background.
 */
export const GBP_PREFETCH_ACTIVE_DAYS = 7;
/** Location: every 3 hours between 6:00 and 22:00 (Europe/Warsaw). */
export const GBP_PREFETCH_LOCATION_CRON = "0 6-22/3 * * *";
/** Photos: once a day in the morning. */
export const GBP_PREFETCH_MEDIA_CRON = "0 6 * * *";
/** Statistics: once a day at night - Google updates them once a day. */
export const GBP_PREFETCH_METRICS_CRON = "0 3 * * *";
export const GBP_PREFETCH_TIMEZONE = "Europe/Warsaw";
