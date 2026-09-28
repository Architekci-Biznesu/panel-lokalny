import type { ContentTargetStatus } from "@/lib/db/schema";
import {
  STATUS_META,
  TARGET_STATUS_META,
  type ContentDisplayStatus,
} from "@/features/publikacje/content-status";

export function ContentStatusPill({
  status,
}: {
  status: ContentDisplayStatus;
}) {
  const meta = STATUS_META[status];
  return <span className={`ui-pill ${meta.pill}`}>{meta.label}</span>;
}

export function TargetStatusPill({ status }: { status: ContentTargetStatus }) {
  const meta = TARGET_STATUS_META[status];
  return <span className={`ui-pill ${meta.pill}`}>{meta.label}</span>;
}

const DATE_FMT = new Intl.DateTimeFormat("pl-PL", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Europe/Warsaw",
});

const DATE_TIME_FMT = new Intl.DateTimeFormat("pl-PL", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Warsaw",
});

export function formatPubDate(date: Date | null): string {
  return date ? DATE_FMT.format(date) : "-";
}

export function formatPubDateTime(date: Date | null): string {
  return date ? DATE_TIME_FMT.format(date) : "-";
}
