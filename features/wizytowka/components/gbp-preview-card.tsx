import { Check, Globe, MapPin, Phone, SquareArrowOutUpRight } from "lucide-react";
import type { CompletenessSummary } from "@/features/wizytowka/completeness";
import { formatAddress, type GbpLocation } from "@/features/wizytowka/types";

/** Two-column checklist order matching the profile completeness mock. */
const CHECK_DISPLAY_ORDER = [
  "title",
  "description",
  "website",
  "hours",
  "photos",
  "primary_category",
  "phone",
  "address",
  "services",
  "attributes",
] as const;

function displayUrl(url: string) {
  return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
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
  const complete =
    summary.filledCount >= summary.filledTotal && summary.filledTotal > 0;
  const pct =
    summary.filledTotal > 0
      ? Math.round((summary.filledCount / summary.filledTotal) * 100)
      : 0;
  const ring = 2 * Math.PI * 18;
  const dash = (pct / 100) * ring;

  const byId = new Map(summary.checks.map((check) => [check.id, check]));
  const orderedChecks = CHECK_DISPLAY_ORDER.map((id) => byId.get(id)).filter(
    (check): check is NonNullable<typeof check> => Boolean(check),
  );

  return (
    <div className="wiz-profile-header">
      <div className="wiz-profile-thumb" aria-hidden>
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumb} alt="" referrerPolicy="no-referrer" />
        ) : (
          <span className="wiz-profile-thumb-ph">[ZDJĘCIE]</span>
        )}
      </div>

      <div className="wiz-profile-main">
        <div className="wiz-profile-left">
          <div className="wiz-profile-info">
            <h2 className="wiz-profile-title">{title}</h2>
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
                  className="wiz-ext-link"
                >
                  Otwórz w Mapach Google
                  <SquareArrowOutUpRight
                    aria-hidden
                    className="wiz-ext-link-icon"
                  />
                </a>
              ) : null}
            </p>
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
                <span className="wiz-profile-tile-value tabular">
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
                    className="wiz-profile-tile-value wiz-ext-link"
                  >
                    {displayUrl(website)}
                    <SquareArrowOutUpRight
                      aria-hidden
                      className="wiz-ext-link-icon"
                    />
                  </a>
                ) : (
                  <span className="wiz-profile-tile-value">Brak strony</span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="wiz-profile-complete" aria-label="Kompletność profilu">
          <div
            className={`wiz-profile-ring${complete ? " is-complete" : pct >= 80 ? " is-high" : pct >= 50 ? " is-mid" : ""}`}
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Kompletność ${summary.filledCount} z ${summary.filledTotal}`}
          >
            <svg viewBox="0 0 44 44" aria-hidden>
              <circle
                className="wiz-profile-ring-track"
                cx="22"
                cy="22"
                r="18"
              />
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
            <span className="wiz-profile-ring-label tabular">
              {summary.filledCount}/{summary.filledTotal}
            </span>
            <span className="wiz-profile-ring-caption">Kompletność</span>
          </div>

          <ul className="wiz-profile-checks">
            {orderedChecks.map((check) => (
              <li
                key={check.id}
                className={
                  check.filled
                    ? "wiz-profile-check is-done"
                    : "wiz-profile-check"
                }
              >
                <span className="wiz-profile-check-mark" aria-hidden>
                  {check.filled ? <Check /> : null}
                </span>
                <span className="wiz-profile-check-label">{check.label}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
