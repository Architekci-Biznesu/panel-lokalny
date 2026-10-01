import Link from "next/link";
import { ArrowUpRight, ChevronRight } from "lucide-react";
import {
  GOOGLE_FIELD_LABELS,
  type GoogleField,
  type GoogleFieldChange,
} from "@/features/wizytowka/google-updates";

/** Where each field is edited (the choice about Google's version is there). */
const FIELD_HREF: Record<GoogleField, string> = {
  title: "/wizytowka/informacje#wiz-field-title",
  description: "/wizytowka/informacje#wiz-field-description",
  categories: "/wizytowka/informacje#wiz-field-primary_category",
  phone: "/wizytowka/informacje#wiz-field-phone",
  website: "/wizytowka/informacje#wiz-field-website",
  address: "/wizytowka/informacje#wiz-field-address",
  serviceArea: "/wizytowka/informacje#wiz-field-service-area",
  regularHours: "/wizytowka/informacje#wiz-field-hours",
  specialHours: "/wizytowka/informacje#wiz-field-special-hours",
  openInfo: "/wizytowka/informacje",
  services: "/wizytowka/uslugi#wiz-field-services",
};

function labels(changes: GoogleFieldChange[]): string {
  return changes.map((c) => GOOGLE_FIELD_LABELS[c.field]).join(", ");
}

/**
 * Card under the listing preview: fields Google changed itself (diffMask) and
 * the owner's edits still under Google's review (pendingMask /
 * metadata.hasPendingEdits). One row per state; the choice per field is next
 * to the field, so a Google row links there.
 */
export function GoogleStatusCard({
  changes,
  hasPendingEdits = false,
  mapsUri,
}: {
  changes: GoogleFieldChange[];
  /** Google reports pending edits without naming the fields. */
  hasPendingEdits?: boolean;
  mapsUri?: string | null;
}) {
  const google = changes.filter((c) => c.kind === "google");
  const waiting = changes.filter((c) => c.kind === "pending");
  if (!google.length && !waiting.length && !hasPendingEdits) return null;

  const single = google.length === 1 ? google[0] : null;

  return (
    <section className="wiz-gstatus" aria-label="Stan w Google">
      {google.length ? (
        <div className="wiz-gstatus-row" role="status">
          <span className="wiz-gdot" aria-hidden />
          <div className="wiz-gstatus-copy">
            <p className="wiz-gstatus-title">
              Google zmienił {google.length === 1 ? "pole" : "pola"}:{" "}
              {labels(google)}
            </p>
            <p className="wiz-gstatus-desc">
              {single?.customerValue ? (
                <>
                  Klienci widzą{" "}
                  <span className="wiz-gstatus-value">
                    „{single.customerValue}”
                  </span>{" "}
                  zamiast Twojej wersji.
                </>
              ) : (
                "Klienci widzą wersję Google zamiast Twojej."
              )}
            </p>
          </div>
          <Link href={FIELD_HREF[google[0].field]} className="wiz-gstatus-go">
            Zdecyduj przy polu
            <span className="wiz-gstatus-go-icon" aria-hidden>
              <ChevronRight />
            </span>
          </Link>
        </div>
      ) : null}
      {waiting.length || hasPendingEdits ? (
        <div className="wiz-gstatus-row" role="status">
          <span className="wiz-gdot is-pending" aria-hidden />
          <div className="wiz-gstatus-copy">
            <p className="wiz-gstatus-title">
              {waiting.length
                ? `Czeka na Google: ${labels(waiting)}`
                : "Twoje zmiany czekają na Google"}
            </p>
            <p className="wiz-gstatus-desc">
              Zwykle kilka minut. Do tego czasu klienci widzą poprzednią wersję.
            </p>
          </div>
          {mapsUri ? (
            <a
              href={mapsUri}
              target="_blank"
              rel="noopener noreferrer"
              className="wiz-glink"
            >
              Zobacz w Google
              <ArrowUpRight aria-hidden />
            </a>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
