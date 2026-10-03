import type { Queue } from "bullmq";
import type { MaintenanceJob } from "@/lib/queue";
import {
  GBP_PREFETCH_LOCATION_CRON,
  GBP_PREFETCH_MEDIA_CRON,
  GBP_PREFETCH_METRICS_CRON,
  GBP_PREFETCH_TIMEZONE,
} from "@/lib/config/freshness";
import { REVIEW_SYNC_AUTO_EVERY_MS } from "@/lib/config/job-limits";

const MINUTE = 60 * 1000;

/**
 * Cyclic jobs of the `maintenance` queue. Upserted on every worker start, so
 * a changed interval replaces the old one (ids are stable).
 */
export const SCHEDULES: Array<{
  id: string;
  repeat: { every: number } | { pattern: string; tz: string };
  job: MaintenanceJob;
}> = [
  {
    id: "scheduled-posts",
    repeat: { every: MINUTE },
    job: { task: "scheduled-posts" },
  },
  {
    id: "stale-runs",
    repeat: { every: 5 * MINUTE },
    job: { task: "stale-runs" },
  },
  {
    id: "auto-scans",
    repeat: { pattern: "0 4 * * *", tz: GBP_PREFETCH_TIMEZONE },
    job: { task: "auto-scans" },
  },
  // Auto-mode profiles every run, the others every 3 h (decided per profile).
  {
    id: "review-sweep",
    repeat: { every: REVIEW_SYNC_AUTO_EVERY_MS },
    job: { task: "review-sweep" },
  },
  {
    id: "prefetch-location",
    repeat: { pattern: GBP_PREFETCH_LOCATION_CRON, tz: GBP_PREFETCH_TIMEZONE },
    job: { task: "prefetch", kind: "location" },
  },
  {
    id: "prefetch-media",
    repeat: { pattern: GBP_PREFETCH_MEDIA_CRON, tz: GBP_PREFETCH_TIMEZONE },
    job: { task: "prefetch", kind: "media" },
  },
  {
    id: "prefetch-metrics",
    repeat: { pattern: GBP_PREFETCH_METRICS_CRON, tz: GBP_PREFETCH_TIMEZONE },
    job: { task: "prefetch", kind: "metrics" },
  },
];

export async function upsertSchedules(queue: Queue<MaintenanceJob>) {
  const ids = new Set(SCHEDULES.map((s) => s.id));
  for (const schedule of SCHEDULES) {
    await queue.upsertJobScheduler(schedule.id, schedule.repeat, {
      name: schedule.job.task,
      data: schedule.job,
    });
  }
  // Schedules removed from the list above stop running.
  for (const existing of await queue.getJobSchedulers()) {
    if (existing.key && !ids.has(existing.key)) {
      await queue.removeJobScheduler(existing.key);
    }
  }
}
