import { ArrowUpRight, Hourglass, RefreshCcw } from "lucide-react";

/**
 * Bar under the listing preview: owner's edits still under Google's review
 * (pendingMask / metadata.hasPendingEdits) or fields Google changed itself
 * (diffMask). Information, not a decision - so outside "Do Twojej decyzji";
 * the choice per field is next to the field.
 */
export function PendingEditsBanner({
  mapsUri,
  kind = "pending",
  fields = [],
}: {
  mapsUri?: string | null;
  kind?: "pending" | "google";
  /** Labels of the affected fields, e.g. ["Nazwa firmy", "Opis"]. */
  fields?: string[];
}) {
  const list = fields.length ? fields.join(", ") : null;
  const title =
    kind === "google"
      ? `Google zmienił ${fields.length === 1 ? "pole" : "pola"}${list ? `: ${list}` : ""}`
      : `Czeka na weryfikację Google${list ? `: ${list}` : ""}`;
  const desc =
    kind === "google"
      ? "Klienci widzą wersję Google. Przy polu wybierzesz, czy ją przyjąć, czy zostawić swoją."
      : "Google zwykle sprawdza zmianę w kilka minut, czasem dłużej. Do tego czasu klienci widzą poprzednią wersję.";

  return (
    <div
      className={`wiz-pending${kind === "google" ? " is-google" : ""}`}
      role="status"
    >
      <span className="wiz-pending-icon" aria-hidden>
        {kind === "google" ? <RefreshCcw /> : <Hourglass />}
      </span>
      <div className="wiz-pending-copy">
        <p className="wiz-pending-title">{title}</p>
        <p className="wiz-pending-desc">{desc}</p>
      </div>
      {mapsUri ? (
        <a
          href={mapsUri}
          target="_blank"
          rel="noopener noreferrer"
          className="ui-btn ui-btn-white ui-btn-sm wiz-pending-link"
        >
          Zobacz w Google
          <ArrowUpRight aria-hidden />
        </a>
      ) : null}
    </div>
  );
}
