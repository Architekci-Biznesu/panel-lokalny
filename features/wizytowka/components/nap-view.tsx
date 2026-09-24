"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { ExternalLink, Loader2 } from "lucide-react";
import { toast } from "gooey-toast";
import { requestNapInterest } from "@/features/wizytowka/actions";

type NapStatus = "published" | "in_progress" | "pending";

type SampleNapEntry = {
  id: string;
  name: string;
  url: string;
  status: NapStatus;
};

/** Temporary sample rows so the NAP list layout can be reviewed. */
const SAMPLE_NAP_ENTRIES: SampleNapEntry[] = [
  {
    id: "panorama",
    name: "Panorama Firm",
    url: "https://panoramafirm.pl",
    status: "published",
  },
  {
    id: "zumi",
    name: "Zumi",
    url: "https://www.zumi.pl",
    status: "published",
  },
  {
    id: "pkt",
    name: "PKT.pl",
    url: "https://www.pkt.pl",
    status: "published",
  },
  {
    id: "aleo",
    name: "Aleo",
    url: "https://aleo.com",
    status: "in_progress",
  },
  {
    id: "gowork",
    name: "GoWork",
    url: "https://www.gowork.pl",
    status: "in_progress",
  },
  {
    id: "firmy",
    name: "Firmy.net",
    url: "https://www.firmy.net",
    status: "pending",
  },
  {
    id: "biznesfinder",
    name: "BiznesFinder",
    url: "https://www.biznesfinder.pl",
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

  return (
    <div className="wiz-stack">
      <div className="wiz-tab-head">
        <div>
          <h2 className="text-lg font-semibold">NAP i katalogi</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Spójne wpisy Name / Address / Phone w katalogach zewnętrznych
            realizuje zespół agencji. Tutaj widzisz status i możesz zgłosić
            zainteresowanie dodatkowymi wpisami.
          </p>
        </div>
      </div>

      <div className="wiz-uslugi">
        <ul className="wiz-uslugi-list">
          {SAMPLE_NAP_ENTRIES.map((entry) => {
            const status = STATUS_META[entry.status];
            return (
              <li key={entry.id} className="wiz-attr-row">
                <div className="wiz-nap-main">
                  <div className="wiz-field-label">{entry.name}</div>
                  <a
                    href={entry.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="wiz-nap-url"
                  >
                    <span>{entry.url.replace(/^https?:\/\//, "")}</span>
                    <ExternalLink aria-hidden />
                  </a>
                </div>
                <span className={status.pill}>{status.label}</span>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="wiz-tab-panel">
        <div className="wiz-nap-status">
          <span className="ui-pill ui-pill-neutral">Status</span>
          <p className="mt-2 text-sm">
            {requestsCount > 0
              ? `Zgłoszono zainteresowanie (${requestsCount}). Skontaktujemy się w sprawie realizacji.`
              : "Brak aktywnych zgłoszeń dodatkowych wpisów NAP."}
          </p>
        </div>

        <div className="wiz-tab-panel-actions">
          <button
            type="button"
            className="ui-btn ui-btn-primary"
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
            {pending ? <Loader2 aria-hidden className="ui-btn-spinner" /> : null}
            Dokup dodatkowe wpisy NAP
          </button>
        </div>
      </div>
    </div>
  );
}
