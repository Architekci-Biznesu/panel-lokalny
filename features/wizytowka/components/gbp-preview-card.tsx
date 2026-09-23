import { Clock, Globe, MapPin, Phone } from "lucide-react";
import {
  formatAddress,
  formatTime,
  WEEKDAYS,
  type GbpLocation,
} from "@/features/wizytowka/types";

function hoursSummary(location: GbpLocation): string {
  const periods = location.regularHours?.periods ?? [];
  if (!periods.length) return "Godziny nieuzupełnione";

  const byDay = new Map<string, string>();
  for (const p of periods) {
    if (!p.openDay) continue;
    const slot = `${formatTime(p.openTime)}-${formatTime(p.closeTime)}`;
    const prev = byDay.get(p.openDay);
    byDay.set(p.openDay, prev ? `${prev}, ${slot}` : slot);
  }

  const parts: string[] = [];
  for (const day of WEEKDAYS) {
    const hours = byDay.get(day.value);
    if (hours) parts.push(`${day.label.slice(0, 3)} ${hours}`);
  }

  if (parts.length === 0) return "Godziny nieuzupełnione";
  if (parts.length <= 3) return parts.join(" · ");
  return `${parts.slice(0, 2).join(" · ")} · +${parts.length - 2} dni`;
}

export function GbpPreviewCard({
  location,
  coverUrl,
}: {
  location: GbpLocation;
  coverUrl: string | null;
}) {
  const title = location.title ?? "Wizytówka Google";
  const category =
    location.categories?.primaryCategory?.displayName ??
    location.categories?.primaryCategory?.name?.replace(/^categories\/gcid:/, "") ??
    null;
  const address = formatAddress(location.storefrontAddress);
  const phone = location.phoneNumbers?.primaryPhone;
  const website = location.websiteUri;
  const initial = title.trim().charAt(0).toUpperCase() || "G";

  return (
    <div className="wiz-preview-card">
      <div className="wiz-preview-cover">
        {coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={coverUrl} alt="" className="wiz-preview-cover-img" />
        ) : (
          <div className="wiz-preview-cover-placeholder" aria-hidden>
            <span>{initial}</span>
          </div>
        )}
      </div>
      <div className="wiz-preview-body">
        <h2 className="wiz-preview-title">{title}</h2>
        {category ? (
          <p className="wiz-preview-category">{category}</p>
        ) : null}
        <ul className="wiz-preview-meta">
          {address ? (
            <li>
              <MapPin aria-hidden />
              <span>{address}</span>
            </li>
          ) : null}
          {phone ? (
            <li>
              <Phone aria-hidden />
              <span className="mono">{phone}</span>
            </li>
          ) : null}
          {website ? (
            <li>
              <Globe aria-hidden />
              <a
                href={website}
                target="_blank"
                rel="noopener noreferrer"
                className="wiz-inline-link"
              >
                {website.replace(/^https?:\/\//, "")}
              </a>
            </li>
          ) : null}
          <li>
            <Clock aria-hidden />
            <span>{hoursSummary(location)}</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
