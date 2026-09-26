"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ChevronDown,
  ChevronUp,
  FileText,
} from "lucide-react";

export type PulpitPublication = {
  id: string;
  title: string;
  status: "pending" | "published" | "draft" | "scheduled";
  channel: string;
  dateLabel: string;
  excerpt?: string;
  chips?: string[];
  meta?: string[];
};

const STATUS_META: Record<
  PulpitPublication["status"],
  { label: string; pill: string; icon: string }
> = {
  pending: {
    label: "Do akceptacji",
    pill: "ui-pill ui-pill-warn",
    icon: "is-warn",
  },
  published: {
    label: "Opublikowano",
    pill: "ui-pill ui-pill-success",
    icon: "is-published",
  },
  draft: {
    label: "Szkic",
    pill: "ui-pill ui-pill-neutral",
    icon: "is-draft",
  },
  scheduled: {
    label: "Zaplanowano",
    pill: "ui-pill ui-pill-info",
    icon: "is-scheduled",
  },
};

export function RecentPublications({
  items,
}: {
  items: PulpitPublication[];
}) {
  const [openId, setOpenId] = useState<string | null>(items[0]?.id ?? null);

  return (
    <section className="pulpit-list-block">
      <header className="pulpit-list-head">
        <h2 className="pulpit-card-title">Ostatnie publikacje</h2>
        <Link href="/publikacje/wszystkie" className="pulpit-list-link">
          Zobacz wszystkie
        </Link>
      </header>

      {items.length === 0 ? (
        <p className="pulpit-empty">
          {/* TODO Styl 4: podłączyć loader publikacji, gdy będzie w projekcie */}
          Brak publikacji do pokazania.
        </p>
      ) : (
        <ul className="pulpit-pub-list">
          {items.map((item) => {
            const meta = STATUS_META[item.status];
            const open = openId === item.id;
            return (
              <li
                key={item.id}
                className={`pulpit-pub-row${open ? " is-open" : ""}`}
              >
                <button
                  type="button"
                  className="pulpit-pub-main"
                  onClick={() => setOpenId(open ? null : item.id)}
                  aria-expanded={open}
                >
                  <span className={`pulpit-pub-icon ${meta.icon}`} aria-hidden>
                    <FileText />
                  </span>
                  <span className="pulpit-pub-copy">
                    <span className="pulpit-pub-title">{item.title}</span>
                    <span className="pulpit-pub-meta">
                      <span className={meta.pill}>{meta.label}</span>
                      <span>
                        {item.channel} · {item.dateLabel}
                      </span>
                    </span>
                  </span>
                  <span className="pulpit-pub-chevron" aria-hidden>
                    {open ? <ChevronUp /> : <ChevronDown />}
                  </span>
                </button>

                {open && item.excerpt ? (
                  <div className="pulpit-pub-detail">
                    {item.chips && item.chips.length > 0 ? (
                      <div className="pulpit-pub-chips">
                        {item.chips.map((chip) => (
                          <span key={chip} className="pulpit-chip">
                            {chip}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    <p className="pulpit-pub-excerpt">{item.excerpt}</p>
                    {item.meta && item.meta.length > 0 ? (
                      <p className="pulpit-pub-detail-meta">
                        {item.meta.join(" · ")}
                      </p>
                    ) : null}
                    <div className="pulpit-pub-actions">
                      {item.status === "pending" ? (
                        <button
                          type="button"
                          className="ui-btn ui-btn-primary ui-btn-sm"
                          disabled
                        >
                          Akceptuj
                        </button>
                      ) : null}
                      <Link
                        href="/publikacje/inbox"
                        className="ui-btn ui-btn-white ui-btn-sm"
                      >
                        Edytuj
                      </Link>
                    </div>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
