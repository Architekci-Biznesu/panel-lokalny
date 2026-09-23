import { Check, Globe, MapPin, Phone } from "lucide-react";
import type { CompletenessSummary } from "@/features/wizytowka/completeness";
import { formatAddress, type GbpLocation } from "@/features/wizytowka/types";

function openStatusLabel(status?: string): string {
  switch (status) {
    case "OPEN":
      return "Otwarte";
    case "CLOSED_TEMPORARILY":
      return "Tymczasowo zamknięte";
    case "CLOSED_PERMANENTLY":
      return "Trwale zamknięte";
    default:
      return "";
  }
}

function openStatusTone(status?: string): "success" | "warn" | "danger" | "neutral" {
  if (status === "OPEN") return "success";
  if (status === "CLOSED_TEMPORARILY") return "warn";
  if (status === "CLOSED_PERMANENTLY") return "danger";
  return "neutral";
}

function truncateUrl(url: string, max = 36) {
  const clean = url.replace(/^https?:\/\//, "").replace(/\/$/, "");
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1)}…`;
}

export function GbpPreviewCard({
  location,
  photoUrls,
  summary,
}: {
  location: GbpLocation;
  photoUrls: string[];
  summary: CompletenessSummary;
}) {
  const title = location.title ?? "Wizytówka Google";
  const category =
    location.categories?.primaryCategory?.displayName ??
    location.categories?.primaryCategory?.name?.replace(
      /^categories\/gcid:/,
      "",
    ) ??
    null;
  const address = formatAddress(location.storefrontAddress);
  const phone = location.phoneNumbers?.primaryPhone;
  const website = location.websiteUri;
  const mapsUri = location.metadata?.mapsUri;
  const thumb = photoUrls[0] ?? null;
  const status = location.openInfo?.status;
  const statusLabel = openStatusLabel(status);
  const statusTone = openStatusTone(status);
  const complete = summary.filledCount >= summary.filledTotal && summary.filledTotal > 0;
  const pct =
    summary.filledTotal > 0
      ? Math.round((summary.filledCount / summary.filledTotal) * 100)
      : 0;
  const ring = 2 * Math.PI * 18;
  const dash = (pct / 100) * ring;

  return (
    <div className="wiz-profile-header">
      <div className="wiz-profile-left">
        <div className="wiz-profile-identity">
          <div className="wiz-profile-thumb" aria-hidden>
            {thumb ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={thumb} alt="" referrerPolicy="no-referrer" />
            ) : (
              <span className="wiz-profile-thumb-ph">[ZDJĘCIE]</span>
            )}
          </div>
          <div className="wiz-profile-info">
            <h2 className="wiz-profile-title">{title}</h2>
            {statusLabel ? (
              <span
                className={`wiz-profile-status wiz-profile-status-${statusTone}`}
              >
                <span className="wiz-profile-status-dot" aria-hidden />
                {statusLabel}
              </span>
            ) : null}
            <p className="wiz-profile-subline">
              {category ? <span>{category}</span> : null}
              {category && mapsUri ? (
                <span className="wiz-profile-sub-sep" aria-hidden>
                  ·
                </span>
              ) : null}
              {mapsUri ? (
                <a
                  href={mapsUri}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="wiz-inline-link"
                >
                  Otwórz w Mapach Google
                </a>
              ) : null}
            </p>
          </div>
        </div>

        <div className="wiz-profile-tiles">
          <div className="wiz-profile-tile">
            <span className="wiz-profile-tile-icon" aria-hidden>
              <MapPin />
            </span>
            <div className="wiz-profile-tile-body">
              <span className="wiz-profile-tile-label">Adres</span>
              <span className="wiz-profile-tile-value">
                {address || "Brak adresu"}
              </span>
            </div>
          </div>
          <div className="wiz-profile-tile">
            <span className="wiz-profile-tile-icon" aria-hidden>
              <Phone />
            </span>
            <div className="wiz-profile-tile-body">
              <span className="wiz-profile-tile-label">Telefon</span>
              <span className="wiz-profile-tile-value mono">
                {phone || "Brak telefonu"}
              </span>
            </div>
          </div>
          <div className="wiz-profile-tile">
            <span className="wiz-profile-tile-icon" aria-hidden>
              <Globe />
            </span>
            <div className="wiz-profile-tile-body">
              <span className="wiz-profile-tile-label">Strona WWW</span>
              {website ? (
                <a
                  href={website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="wiz-profile-tile-value wiz-inline-link"
                >
                  {truncateUrl(website)}
                </a>
              ) : (
                <span className="wiz-profile-tile-value">Brak strony</span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="wiz-profile-complete" aria-label="Kompletność profilu">
        <div className="wiz-profile-complete-head">
          <div
            className="wiz-profile-ring"
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <svg viewBox="0 0 44 44" aria-hidden>
              <circle className="wiz-profile-ring-track" cx="22" cy="22" r="18" />
              <circle
                className="wiz-profile-ring-fill"
                cx="22"
                cy="22"
                r="18"
                style={{
                  strokeDasharray: `${dash} ${ring}`,
                }}
              />
            </svg>
            <span className="wiz-profile-ring-label mono">
              {summary.filledCount}/{summary.filledTotal}
            </span>
          </div>
          <div className="wiz-profile-complete-copy">
            <p className="wiz-profile-complete-title">
              {complete ? "Profil kompletny" : "Uzupełnij profil"}
            </p>
            <p className="wiz-profile-complete-desc">
              {complete
                ? "Wszystkie kluczowe pola uzupełnione"
                : `${summary.filledCount} z ${summary.filledTotal} kluczowych pól`}
            </p>
          </div>
        </div>
        <ul className="wiz-profile-checks">
          {summary.checks.map((check) => (
            <li
              key={check.id}
              className={
                check.filled
                  ? "wiz-profile-check is-done"
                  : "wiz-profile-check"
              }
            >
              <Check aria-hidden />
              <span>{check.label}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
