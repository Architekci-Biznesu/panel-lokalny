import { ChevronDown } from "lucide-react";
import { ModuleHeader } from "@/features/shell/module-header";
import { Skel, SkelButton, SkelSubnav } from "@/features/shell/skeleton";
import { STATUS_FILTERS } from "@/features/publikacje/components/history-list";
import {
  PUBLIKACJE_HEADER,
  PUBLIKACJE_TABS,
} from "@/features/publikacje/module";

/** Publikacje on first entry - the same containers as PostsWorkspace. */
export function PublikacjeSkeleton() {
  return (
    <div
      className="pub-page"
      aria-busy="true"
      aria-label="Ładowanie publikacji"
    >
      <ModuleHeader
        {...PUBLIKACJE_HEADER}
        actions={
          <div className="pub-header-actions">
            <SkelButton w="7.5rem" />
            <SkelButton w="10rem" />
          </div>
        }
      />
      <SkelSubnav tabs={PUBLIKACJE_TABS} />
      <div className="pub-body">
        <div className="pub-workspace">
          <div className="pub-workspace-list">
            <div className="pub-filters" aria-hidden>
              <nav className="pub-seg">
                {STATUS_FILTERS.map((filter, index) => (
                  <span
                    key={filter.value}
                    className={`pub-seg-item${index === 0 ? " is-active" : ""}`}
                  >
                    {filter.label}
                  </span>
                ))}
              </nav>
              <span className="pub-channel">
                <span className="pub-channel-trigger">
                  <span className="pub-channel-label">Kanał</span>
                  Wszystkie
                  <ChevronDown aria-hidden />
                </span>
              </span>
            </div>
            {[0, 1].map((i) => (
              <div key={i} className="pub-card pub-card-skeleton">
                <span className="ui-skel pub-card-skel-media" />
                <div className="pub-card-skel-body">
                  <Skel w="40%" h="1.125rem" />
                  <Skel w="100%" />
                  <Skel w="92%" />
                  <Skel w="70%" />
                </div>
              </div>
            ))}
          </div>
          {/* The live dock gets its height from useDockHeight (its top to the
              window bottom minus 40 px); at page top that is this. */}
          <aside
            className="pub-chat-dock"
            aria-hidden
            style={{ height: "calc(100dvh - 292px)" }}
          >
            <header className="pub-chat-head">
              <div className="pub-chat-head-text">
                <h2 className="pub-chat-title">
                  Czat <span className="pub-ai-text">AI</span>
                </h2>
                <p className="pub-chat-sub">Nowe propozycje postów</p>
              </div>
            </header>
            <div className="pub-chat-thread">
              <Skel w="70%" />
              <Skel w="85%" />
              <Skel w="55%" />
            </div>
            <div className="pub-chat-foot">
              <Skel w="100%" h="var(--btn-height)" />
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
