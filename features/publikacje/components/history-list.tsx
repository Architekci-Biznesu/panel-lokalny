import { ChevronDown, ImageIcon } from "lucide-react";
import Link from "next/link";
import type { ContentChannel } from "@/lib/db/schema";
import {
  CHANNEL_LABELS,
  HISTORY_STATUS_FILTERS,
  type HistoryStatusFilter,
} from "@/features/publikacje/content-status";
import {
  ContentStatusPill,
  TargetStatusPill,
  formatPubDate,
  formatPubDateTime,
} from "@/features/publikacje/components/content-status-pill";
import type { HistoryItem } from "@/features/publikacje/load-history";

const CHANNEL_FILTERS: Array<{ value: ContentChannel | "all"; label: string }> =
  [
    { value: "all", label: "Wszystkie" },
    { value: "gbp", label: CHANNEL_LABELS.gbp },
    { value: "facebook", label: CHANNEL_LABELS.facebook },
    { value: "instagram", label: CHANNEL_LABELS.instagram },
  ];

/** "Do akceptacji" first - it is the default view when something waits. */
const STATUS_ORDER: HistoryStatusFilter[] = [
  "pending",
  "scheduled",
  "published",
  "failed",
  "rejected",
  "all",
];

const STATUS_FILTERS = STATUS_ORDER.map((value) =>
  HISTORY_STATUS_FILTERS.find((f) => f.value === value)!,
);

function filterHref(
  status: HistoryStatusFilter,
  channel: ContentChannel | "all",
): string {
  // status is always explicit - without it the page picks a default.
  const params = new URLSearchParams({ status });
  if (channel !== "all") params.set("kanal", channel);
  return `/publikacje?${params.toString()}`;
}

/**
 * Status as one segmented control (links, work without JS) and the channel as
 * a small menu - channels other than Google are still "wkrótce".
 */
export function HistoryFilters({
  status,
  channel,
  pendingCount,
}: {
  status: HistoryStatusFilter;
  channel: ContentChannel | "all";
  pendingCount: number;
}) {
  const channelLabel =
    CHANNEL_FILTERS.find((f) => f.value === channel)?.label ?? "Wszystkie";

  return (
    <div className="pub-filters">
      <nav className="pub-seg" aria-label="Status">
        {STATUS_FILTERS.map((filter) => {
          const active = status === filter.value;
          const count = filter.value === "pending" ? pendingCount : 0;
          return (
            <Link
              key={filter.value}
              href={filterHref(filter.value, channel)}
              className={`pub-seg-item${active ? " is-active" : ""}`}
              aria-current={active ? "true" : undefined}
            >
              {filter.label}
              {count ? (
                <span className="pub-seg-count mono">{count}</span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      {/* key: the menu closes after picking (navigation keeps the DOM) */}
      <details key={channel} className="pub-channel">
        <summary className="pub-channel-trigger">
          <span className="pub-channel-label">Kanał</span>
          {channelLabel}
          <ChevronDown aria-hidden />
        </summary>
        <div className="ui-menu pub-channel-menu">
          {CHANNEL_FILTERS.map((filter) => (
            <Link
              key={filter.value}
              href={filterHref(status, filter.value)}
              className={`ui-menu-item${channel === filter.value ? " is-selected" : ""}`}
              aria-current={channel === filter.value ? "true" : undefined}
            >
              {filter.value === "all" ? "Wszystkie kanały" : filter.label}
            </Link>
          ))}
        </div>
      </details>
    </div>
  );
}

/** History table on desktop, cards on mobile (same markup, CSS grid). */
export function HistoryList({ items }: { items: HistoryItem[] }) {
  if (items.length === 0) {
    return (
      <p className="pub-empty-line">Brak publikacji dla wybranych filtrów.</p>
    );
  }

  return (
    <ul className="pub-history">
      <li className="pub-history-head" aria-hidden>
        <span>Publikacja</span>
        <span>Status</span>
        <span>Gdzie</span>
        <span className="pub-history-head-date">Data</span>
      </li>
      {items.map((item) => (
        <li key={item.id} className="pub-history-row">
          <div className="pub-history-main">
            {item.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- public R2 URL, domain set per environment
              <img src={item.imageUrl} alt="" className="pub-history-thumb" />
            ) : (
              <span className="pub-history-thumb is-empty" aria-hidden>
                <ImageIcon />
              </span>
            )}
            <div className="pub-history-text">
              <p className="pub-history-title">{item.title}</p>
              <p className="pub-history-excerpt">{item.body}</p>
            </div>
          </div>
          <div className="pub-history-status">
            <ContentStatusPill status={item.status} />
          </div>
          <ul className="pub-history-targets">
            {item.targets.length === 0 ? (
              <li className="pub-history-muted">-</li>
            ) : (
              item.targets.map((target) => (
                <li key={target.id} className="pub-history-target">
                  <span>
                    {CHANNEL_LABELS[target.channel]} · {target.profileName}
                  </span>
                  {item.targets.length > 1 ? (
                    <TargetStatusPill status={target.status} />
                  ) : null}
                  {target.error ? (
                    <span className="pub-history-error">{target.error}</span>
                  ) : null}
                </li>
              ))
            )}
          </ul>
          <div className="pub-history-when">
            <span
              className="pub-history-date mono"
              title={
                item.targets.find((t) => t.externalId)?.externalId
                  ? `Post w Google: ${item.targets
                      .find((t) => t.externalId)
                      ?.externalId?.split("/")
                      .pop()}`
                  : undefined
              }
            >
              {item.when
                ? formatPubDateTime(item.when)
                : formatPubDate(item.createdAt)}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}
