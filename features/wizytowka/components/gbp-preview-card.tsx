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

const BAR_TICKS = 40;
const NEXT_TICKS = 3;

function displayUrl(url: string) {
  return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

function barTickClass(index: number, filledTicks: number): string {
  if (index < filledTicks) return "wiz-complete-tick is-on";
  if (index < filledTicks + NEXT_TICKS) return "wiz-complete-tick is-next";
  return "wiz-complete-tick";
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
  const city = location.storefrontAddress?.locality?.trim() || null;
  const address = formatAddress(location.storefrontAddress);
  const phone = location.phoneNumbers?.primaryPhone?.trim() || null;
  const website = location.websiteUri?.trim() || null;
  const mapsUri = location.metadata?.mapsUri?.trim() || null;
  const collage = photoUrls.slice(0, 4);
  const filled = summary.filledCount;
  const total = Math.max(summary.filledTotal, 1);
  const filledTicks = Math.round((BAR_TICKS * filled) / total);

  const byId = new Map(summary.checks.map((check) => [check.id, check]));
  const orderedChecks = CHECK_DISPLAY_ORDER.map((id) => byId.get(id)).filter(
    (check): check is NonNullable<typeof check> => Boolean(check),
  );
  const leftChecks = orderedChecks.slice(0, 5);
  const rightChecks = orderedChecks.slice(5, 10);

  return (
    <div className="wiz-top-row">
      <article className="wiz-preview-card">
        <div className="wiz-preview-media" aria-hidden>
          {collage.length > 0 ? (
            <div
              className={
                collage.length === 1
                  ? "wiz-preview-collage is-single"
                  : "wiz-preview-collage"
              }
            >
              {collage.map((url) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={url} src={url} alt="" referrerPolicy="no-referrer" />
              ))}
            </div>
          ) : (
            <span className="wiz-preview-media-ph">[Zdjęcie]</span>
          )}
        </div>

        <div className="wiz-preview-body">
          <div className="wiz-preview-head">
            <div className="wiz-preview-titles">
              <h2 className="wiz-preview-name">{title}</h2>
              {category ? (
                <p className="wiz-preview-category">{category}</p>
              ) : null}
              <div className="wiz-preview-pills">
                <span className="ui-pill ui-pill-neutral">
                  Google Business Profile
                </span>
                {city ? (
                  <span className="ui-pill ui-pill-neutral">{city}</span>
                ) : null}
              </div>
            </div>
            {mapsUri ? (
              <a
                href={mapsUri}
                target="_blank"
                rel="noopener noreferrer"
                className="wiz-preview-open"
                aria-label="Otwórz wizytówkę w Google"
              >
                <SquareArrowOutUpRight aria-hidden />
              </a>
            ) : null}
          </div>

          <div className="wiz-preview-facts">
            <div className="wiz-preview-fact">
              <span className="wiz-preview-fact-label">Adres</span>
              <span className="wiz-preview-fact-value mono">
                {address || "-"}
              </span>
            </div>
            <div className="wiz-preview-fact">
              <span className="wiz-preview-fact-label">Telefon</span>
              <span className="wiz-preview-fact-value mono">
                {phone || "-"}
              </span>
            </div>
            <div className="wiz-preview-fact">
              <span className="wiz-preview-fact-label">Strona WWW</span>
              {website ? (
                <a
                  href={website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="wiz-preview-fact-value mono wiz-preview-fact-link"
                >
                  {displayUrl(website)}
                </a>
              ) : (
                <span className="wiz-preview-fact-value mono">-</span>
              )}
            </div>
          </div>
        </div>
      </article>

      <aside
        className="wiz-complete-card"
        aria-label={`Kompletność profilu ${filled} z ${summary.filledTotal}`}
      >
        <div className="wiz-complete-head">
          <p className="wiz-complete-title">Kompletność profilu</p>
          <p className="wiz-complete-score mono">
            <span className="wiz-complete-score-n">{filled}</span>
            <span className="wiz-complete-score-d">/{summary.filledTotal}</span>
          </p>
        </div>

        <div
          className="wiz-complete-bar"
          role="progressbar"
          aria-valuenow={filled}
          aria-valuemin={0}
          aria-valuemax={summary.filledTotal}
          aria-label={`Kompletność ${filled} z ${summary.filledTotal}`}
        >
          {Array.from({ length: BAR_TICKS }, (_, i) => (
            <span key={i} className={barTickClass(i, filledTicks)} />
          ))}
        </div>

        <div className="wiz-complete-checks">
          <ul className="wiz-complete-col">
            {leftChecks.map((check) => (
              <li
                key={check.id}
                className={
                  check.filled
                    ? "wiz-complete-check is-done"
                    : "wiz-complete-check"
                }
              >
                <span className="wiz-complete-check-mark" aria-hidden>
                  {check.filled ? <Check /> : null}
                </span>
                <span className="wiz-complete-check-label">{check.label}</span>
              </li>
            ))}
          </ul>
          <ul className="wiz-complete-col">
            {rightChecks.map((check) => (
              <li
                key={check.id}
                className={
                  check.filled
                    ? "wiz-complete-check is-done"
                    : "wiz-complete-check"
                }
              >
                <span className="wiz-complete-check-mark" aria-hidden>
                  {check.filled ? <Check /> : null}
                </span>
                <span className="wiz-complete-check-label">{check.label}</span>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}
