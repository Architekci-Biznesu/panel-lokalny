"use client";

import { useRouter } from "next/navigation";
import { useMemo, useTransition } from "react";
import { ChevronRight, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "gooey-toast";
import { requestNapInterest } from "@/features/wizytowka/actions";

type NapStatus = "published" | "in_progress" | "pending";

type SampleNapEntry = {
  id: string;
  name: string;
  initials: string;
  url: string;
  displayUrl: string;
  status: NapStatus;
};

/** Temporary sample rows so the NAP list layout can be reviewed. */
const SAMPLE_NAP_ENTRIES: SampleNapEntry[] = [
  {
    id: "panorama",
    name: "Panorama Firm",
    initials: "PF",
    url: "https://panoramafirm.pl",
    displayUrl: "panoramafirm.pl/[firma]",
    status: "published",
  },
  {
    id: "zumi",
    name: "Zumi",
    initials: "Z",
    url: "https://www.zumi.pl",
    displayUrl: "zumi.pl/[firma]",
    status: "published",
  },
  {
    id: "pkt",
    name: "PKT.pl",
    initials: "PP",
    url: "https://www.pkt.pl",
    displayUrl: "pkt.pl/[firma]",
    status: "published",
  },
  {
    id: "aleo",
    name: "Aleo",
    initials: "A",
    url: "https://aleo.com",
    displayUrl: "aleo.com/[firma]",
    status: "in_progress",
  },
  {
    id: "gowork",
    name: "GoWork",
    initials: "GW",
    url: "https://www.gowork.pl",
    displayUrl: "gowork.pl/[firma]",
    status: "in_progress",
  },
  {
    id: "firmy",
    name: "Firmy.net",
    initials: "F",
    url: "https://www.firmy.net",
    displayUrl: "firmy.net/[firma]",
    status: "pending",
  },
  {
    id: "biznesfinder",
    name: "BiznesFinder",
    initials: "BF",
    url: "https://www.biznesfinder.pl",
    displayUrl: "biznesfinder.pl/[firma]",
    status: "pending",
  },
];

const STATUS_META: Record<
  NapStatus,
  { label: string; pill: string }
> = {
  published: { label: "Opublikowany", pill: "ui-pill ui-pill-success" },
  in_progress: { label: "W trakcie", pill: "ui-pill ui-pill-warn" },
  pending: { label: "Oczekuje", pill: "ui-pill ui-pill-neutral" },
};

export function NapView({ requestsCount }: { requestsCount: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const counts = useMemo(() => {
    let published = 0;
    let inProgress = 0;
    let awaiting = 0;
    for (const entry of SAMPLE_NAP_ENTRIES) {
      if (entry.status === "published") published += 1;
      else if (entry.status === "in_progress") inProgress += 1;
      else awaiting += 1;
    }
    return { published, inProgress, awaiting };
  }, []);

  return (
    <div className="wiz-stack">
      <div className="wiz-tab-head">
        <div className="wiz-tab-head-text">
          <h2>NAP i katalogi</h2>
          <p>
            Spójne wpisy Name / Address / Phone w katalogach zewnętrznych
            realizuje zespół agencji. Tutaj widzisz status i możesz zgłosić
            zainteresowanie dodatkowymi wpisami.
          </p>
        </div>
      </div>

      <div className="wiz-nap-grid">
        <section className="wiz-nap-catalogs">
          <div className="wiz-nap-catalogs-head">
            <h3 className="wiz-nap-tile-title">Katalogi</h3>
            <div className="wiz-nap-summary">
              <span className="ui-pill ui-pill-success">
                {counts.published} opublikowane
              </span>
              <span className="ui-pill ui-pill-warn">
                {counts.inProgress} w trakcie
              </span>
              <span className="ui-pill ui-pill-neutral">
                {counts.awaiting} oczekuje
              </span>
            </div>
          </div>

          <ul className="wiz-nap-list">
            {SAMPLE_NAP_ENTRIES.map((entry) => {
              const status = STATUS_META[entry.status];
              return (
                <li key={entry.id} className="wiz-nap-row">
                  <span className="wiz-nap-initials mono" aria-hidden>
                    {entry.initials}
                  </span>
                  <div className="wiz-nap-main">
                    <div className="wiz-nap-name">{entry.name}</div>
                    <a
                      href={entry.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="wiz-nap-url mono"
                    >
                      <span>{entry.displayUrl}</span>
                      <ExternalLink aria-hidden />
                    </a>
                  </div>
                  <span className={status.pill}>{status.label}</span>
                </li>
              );
            })}
          </ul>
        </section>

        <aside className="wiz-nap-cta">
          <span className="ui-pill ui-pill-neutral">Status</span>
          <h3 className="wiz-nap-cta-title">
            Więcej wpisów = spójniejszy NAP
          </h3>
          <p className="wiz-nap-cta-copy">
            {requestsCount > 0
              ? `Zgłoszono zainteresowanie (${requestsCount}). Skontaktujemy się w sprawie realizacji.`
              : "Brak aktywnych zgłoszeń dodatkowych wpisów NAP."}
          </p>

          <button
            type="button"
            className="wiz-nap-cta-btn"
            disabled={pending}
            onClick={() => {
              startTransition(async () => {
                const result = await requestNapInterest();
                if (!result.ok) {
                  toast.error({
                    title: "Nie udało się zgłosić",
                    description: result.error,
                  });
                  return;
                }
                toast.success({
                  title: "Zgłoszenie zapisane",
                  description:
                    "Dziękujemy - damy znać w sprawie dodatkowych wpisów NAP.",
                });
                router.refresh();
              });
            }}
          >
            <span>
              {pending ? (
                <Loader2 aria-hidden className="ui-btn-spinner" />
              ) : null}
              Dokup dodatkowe wpisy NAP
            </span>
            <ChevronRight aria-hidden />
          </button>

          <p className="wiz-nap-cta-note">
            Po zgłoszeniu: „Zgłoszono zainteresowanie (1). Skontaktujemy się w
            sprawie realizacji.”
          </p>
        </aside>
      </div>
    </div>
  );
}
