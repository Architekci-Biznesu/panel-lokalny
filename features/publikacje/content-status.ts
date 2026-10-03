import type {
  ContentChannel,
  ContentStatus,
  ContentTargetStatus,
} from "@/lib/db/schema";

/** One status per publication, shown in lists and used by the history filter. */
export type ContentDisplayStatus =
  | "pending"
  | "publishing"
  | "scheduled"
  | "published"
  | "partial"
  | "failed"
  | "rejected"
  | "draft";

export function contentDisplayStatus(
  itemStatus: ContentStatus,
  targetStatuses: ContentTargetStatus[],
): ContentDisplayStatus {
  if (itemStatus === "pending") return "pending";
  if (itemStatus === "rejected") return "rejected";
  if (itemStatus === "draft") return "draft";
  if (targetStatuses.length === 0) return "publishing";

  const has = (status: ContentTargetStatus) => targetStatuses.includes(status);
  if (has("queued") || has("publishing")) return "publishing";
  if (has("failed")) return has("published") ? "partial" : "failed";
  if (has("scheduled")) return "scheduled";
  return "published";
}

export const STATUS_META: Record<
  ContentDisplayStatus,
  { label: string; pill: string }
> = {
  pending: { label: "Do akceptacji", pill: "ui-pill-warn" },
  publishing: { label: "Publikuję", pill: "ui-pill-info" },
  scheduled: { label: "Zaplanowano", pill: "ui-pill-info" },
  published: { label: "Opublikowano", pill: "ui-pill-success" },
  partial: { label: "Częściowo", pill: "ui-pill-warn" },
  failed: { label: "Błąd", pill: "ui-pill-danger" },
  rejected: { label: "Odrzucono", pill: "ui-pill-neutral" },
  draft: { label: "Szkic", pill: "ui-pill-neutral" },
};

export const TARGET_STATUS_META: Record<
  ContentTargetStatus,
  { label: string; pill: string }
> = {
  queued: { label: "W kolejce", pill: "ui-pill-info" },
  scheduled: { label: "Zaplanowano", pill: "ui-pill-info" },
  publishing: { label: "Publikuję", pill: "ui-pill-info" },
  published: { label: "Opublikowano", pill: "ui-pill-success" },
  failed: { label: "Błąd", pill: "ui-pill-danger" },
};

export const CHANNEL_LABELS: Record<ContentChannel, string> = {
  gbp: "Google",
  facebook: "Facebook",
  instagram: "Instagram",
};

/** History filter: status chips (display statuses grouped for the customer). */
export const HISTORY_STATUS_FILTERS = [
  { value: "all", label: "Wszystkie" },
  { value: "pending", label: "Do akceptacji" },
  { value: "scheduled", label: "Zaplanowane" },
  { value: "published", label: "Opublikowane" },
  { value: "failed", label: "Błędy" },
  { value: "rejected", label: "Odrzucone" },
] as const;

export type HistoryStatusFilter =
  (typeof HISTORY_STATUS_FILTERS)[number]["value"];

export function matchesStatusFilter(
  status: ContentDisplayStatus,
  filter: HistoryStatusFilter,
): boolean {
  switch (filter) {
    case "all":
      return true;
    case "scheduled":
      return status === "scheduled" || status === "publishing";
    case "failed":
      return status === "failed" || status === "partial";
    case "published":
      return status === "published" || status === "partial";
    default:
      return status === filter;
  }
}

export function parseStatusFilter(value: unknown): HistoryStatusFilter {
  return HISTORY_STATUS_FILTERS.some((f) => f.value === value)
    ? (value as HistoryStatusFilter)
    : "all";
}

export function parseChannelFilter(value: unknown): ContentChannel | "all" {
  return value === "gbp" || value === "facebook" || value === "instagram"
    ? value
    : "all";
}
