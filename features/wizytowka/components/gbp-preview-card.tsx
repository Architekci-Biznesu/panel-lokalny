import { Check, SquareArrowOutUpRight } from "lucide-react";
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
  const filled = summary.filledCount;
  const total = Math.max(summary.filledTotal, 1);
  const segments = Array.from({ length: total }, (_, i) => i < filled);

  const byId = new Map(summary.checks.map((check) => [check.id, check]));
  const orderedChecks = CHECK_DISPLAY_ORDER.map((id) => byId.get(id)).filter(
    (check): check is NonNullable<typeof check> => Boolean(check),
  );

  return (
    <div className="wiz-profile-header">
      {/* In-flow 1×1 SVG is the flex item (intrinsic ratio → width = stretch height).
          Photo overlays it absolutely so it does not affect flex base size. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="wiz-profile-thumb-sizer"
        alt=""
        aria-hidden
        src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1'/%3E"
      />
      <div className="wiz-profile-thumb" aria-hidden>
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            className="wiz-profile-thumb-img"
            src={thumb}
            alt=""
            referrerPolicy="no-referrer"
          />
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
              <div className="wiz-profile-tile-body">
                <span className="wiz-profile-tile-label">Adres</span>
                <span className="wiz-profile-tile-value">
                  {address || "Brak adresu"}
                </span>
              </div>
            </div>
            <div className="wiz-profile-tile">
              <div className="wiz-profile-tile-body">
                <span className="wiz-profile-tile-label">Telefon</span>
                <span className="wiz-profile-tile-value wiz-profile-tile-phone">
                  {phone || "Brak telefonu"}
                </span>
              </div>
            </div>
            <div className="wiz-profile-tile">
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

        <div
          className="wiz-profile-complete"
          aria-label={`Kompletność profilu ${filled} z ${summary.filledTotal}`}
        >
          <p className="wiz-profile-complete-label">Kompletność profilu</p>
          <p className="wiz-profile-complete-score">
            <span className="wiz-profile-complete-score-n">{filled}</span>
            <span className="wiz-profile-complete-score-d">
              /{summary.filledTotal}
            </span>
          </p>
          <div
            className="wiz-profile-complete-bar"
            role="progressbar"
            aria-valuenow={filled}
            aria-valuemin={0}
            aria-valuemax={summary.filledTotal}
            aria-label={`Kompletność ${filled} z ${summary.filledTotal}`}
          >
            {segments.map((on, i) => (
              <span
                key={i}
                className={
                  on
                    ? "wiz-profile-complete-seg is-on"
                    : "wiz-profile-complete-seg"
                }
              />
            ))}
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
