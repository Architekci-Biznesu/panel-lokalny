import { CalendarDays, Check, CircleAlert, Clock, Rows3 } from "lucide-react";
import Link from "next/link";
import type { ContentTargetStatus } from "@/lib/db/schema";

export const TIME_FMT = new Intl.DateTimeFormat("pl-PL", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Warsaw",
});

const WARSAW_DAY = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Warsaw",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Grid cells are calendar days (local y-m-d). */
export function dayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** Publications are placed on their Warsaw day, whatever the server time zone. */
export function warsawDayKey(date: Date): string {
  return WARSAW_DAY.format(date);
}

/** Queued (publishing now) looks like scheduled - it has not gone out yet. */
export function statusTone(
  status: ContentTargetStatus,
): "scheduled" | "published" | "failed" {
  if (status === "published") return "published";
  if (status === "failed") return "failed";
  return "scheduled";
}

export function StatusIcon({ status }: { status: ContentTargetStatus }) {
  const tone = statusTone(status);
  if (tone === "published") return <Check aria-hidden />;
  if (tone === "failed") return <CircleAlert aria-hidden />;
  return <Clock aria-hidden />;
}

/** Kalendarz / Tygodnie - links, so the view is in the URL. */
export function CalendarViewToggle({
  active,
}: {
  active: "kalendarz" | "tygodnie";
}) {
  return (
    <nav className="pub-view" aria-label="Widok kalendarza">
      <Link
        href="/publikacje/kalendarz"
        className={`pub-view-item${active === "kalendarz" ? " is-active" : ""}`}
        aria-current={active === "kalendarz" ? "true" : undefined}
      >
        <CalendarDays aria-hidden />
        Kalendarz
      </Link>
      <Link
        href="/publikacje/kalendarz?widok=tygodnie"
        className={`pub-view-item${active === "tygodnie" ? " is-active" : ""}`}
        aria-current={active === "tygodnie" ? "true" : undefined}
      >
        <Rows3 aria-hidden />
        Tygodnie
      </Link>
    </nav>
  );
}
