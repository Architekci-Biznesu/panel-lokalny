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
    { value: "all", label: "Wszystkie kanały" },
    { value: "gbp", label: CHANNEL_LABELS.gbp },
    { value: "facebook", label: CHANNEL_LABELS.facebook },
    { value: "instagram", label: CHANNEL_LABELS.instagram },
  ];

function filterHref(
  status: HistoryStatusFilter,
  channel: ContentChannel | "all",
): string {
  const params = new URLSearchParams();
  if (status !== "all") params.set("status", status);
  if (channel !== "all") params.set("kanal", channel);
  const query = params.toString();
  return `/publikacje/wszystkie${query ? `?${query}` : ""}`;
}

/** Status and channel filters as link chips (work without JS). */
export function HistoryFilters({
  status,
  channel,
}: {
  status: HistoryStatusFilter;
  channel: ContentChannel | "all";
}) {
  return (
    <div className="pub-filters">
      <div className="pub-filter-group" aria-label="Status">
        {HISTORY_STATUS_FILTERS.map((filter) => (
          <Link
            key={filter.value}
            href={filterHref(filter.value, channel)}
            className={`pub-filter${status === filter.value ? " is-active" : ""}`}
            aria-current={status === filter.value ? "true" : undefined}
          >
            {filter.label}
          </Link>
        ))}
      </div>
      <div className="pub-filter-group" aria-label="Kanał">
        {CHANNEL_FILTERS.map((filter) => (
          <Link
            key={filter.value}
            href={filterHref(status, filter.value)}
            className={`pub-filter${channel === filter.value ? " is-active" : ""}`}
            aria-current={channel === filter.value ? "true" : undefined}
          >
            {filter.label}
          </Link>
        ))}
      </div>
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
        <span>Data</span>
      </li>
      {items.map((item) => (
        <li key={item.id} className="pub-history-row">
          <div className="pub-history-main">
            <p className="pub-history-title">{item.title}</p>
            <p className="pub-history-excerpt">{item.body}</p>
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
                  <TargetStatusPill status={target.status} />
                  {target.error ? (
                    <span className="pub-history-error">{target.error}</span>
                  ) : null}
                  {target.externalId ? (
                    <span
                      className="pub-history-id mono"
                      title="Identyfikator posta w Google"
                    >
                      {target.externalId.split("/").pop()}
                    </span>
                  ) : null}
                </li>
              ))
            )}
          </ul>
          <p className="pub-history-date mono">
            {item.when
              ? formatPubDateTime(item.when)
              : formatPubDate(item.createdAt)}
          </p>
        </li>
      ))}
    </ul>
  );
}
