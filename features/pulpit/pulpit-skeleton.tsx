import { GbpFreshnessPlaceholder } from "@/features/wizytowka/components/gbp-freshness";

// Szkielet ładowania Pulpitu - ten sam układ co PulpitView (KPI + siatka 8/4).

function Bar({ w, h = "0.75rem" }: { w: string; h?: string }) {
  return <span className="ui-skel" style={{ width: w, height: h }} />;
}

// Heights below match the loaded tiles (measured at 1440 px), so the page
// does not jump when data arrives.

function KpiSkel() {
  return (
    <div className="ui-kpi wiz-report-kpi" style={{ minHeight: 247 }}>
      <div className="ui-skel-stack">
        <Bar w="9rem" h="0.75rem" />
        <Bar w="5rem" h="2rem" />
        <Bar w="100%" h="0.5rem" />
        <Bar w="70%" h="0.5rem" />
        <Bar w="55%" h="0.5rem" />
      </div>
    </div>
  );
}

function CardHeadSkel({ leadWide = "16rem" }: { leadWide?: string }) {
  return (
    <header className="pulpit-card-head">
      <div className="pulpit-title-row">
        <span
          className="ui-skel ui-skel-circle"
          style={{ width: 40, height: 40 }}
        />
        <div className="ui-skel-stack">
          <Bar w="10rem" h="1.25rem" />
          <Bar w={leadWide} h="0.75rem" />
        </div>
      </div>
    </header>
  );
}

function ActionRowSkel() {
  return (
    <div className="pulpit-action-row is-static">
      <span
        className="ui-skel"
        style={{ width: 32, height: 32, borderRadius: 10, flexShrink: 0 }}
      />
      <div className="ui-skel-stack" style={{ flex: 1, minWidth: 0 }}>
        <Bar w="7rem" h="0.875rem" />
        <Bar w="11rem" h="0.7rem" />
      </div>
    </div>
  );
}

/** Statistics tiles while the metrics snapshot loads. */
export function KpiStripSkeleton() {
  return (
    <section className="pulpit-section" aria-hidden>
      <div className="wiz-report-summary pulpit-has-reviews">
        <KpiSkel />
        <KpiSkel />
        <KpiSkel />
        <KpiSkel />
      </div>
    </section>
  );
}

/** Visibility chart while the metrics snapshot loads. */
export function VisibilitySkeleton() {
  return (
    <section
      className="pulpit-card pulpit-visibility"
      style={{ minHeight: 390 }}
    >
      <CardHeadSkel leadWide="20rem" />
      <div
        className="ui-skel ui-skel-block"
        style={{ width: "100%", height: "14rem", marginTop: 20 }}
      />
    </section>
  );
}

/** "Co do poprawy" while the listing snapshot loads. */
export function ImproveSkeleton() {
  return (
    <section className="pulpit-card pulpit-improve" style={{ minHeight: 344 }}>
      <CardHeadSkel leadWide="14rem" />
      <div className="pulpit-action-groups" aria-hidden>
        <div className="pulpit-action-group">
          <div className="pulpit-action-group-title">
            <Bar w="7rem" h="0.65rem" />
            <Bar w="1rem" h="0.65rem" />
          </div>
          <div className="pulpit-action-list">
            <ActionRowSkel />
            <ActionRowSkel />
          </div>
        </div>
        <div className="pulpit-action-group">
          <div className="pulpit-action-group-title">
            <Bar w="8rem" h="0.65rem" />
            <Bar w="1rem" h="0.65rem" />
          </div>
          <div className="pulpit-action-list">
            <ActionRowSkel />
          </div>
        </div>
      </div>
      {/* Pusta stopka jak w ImproveCard; niewidoczny tekst trzyma tę samą wysokość. */}
      <div className="pulpit-card-foot" aria-hidden>
        <span style={{ visibility: "hidden" }}>Przejdź do wizytówki</span>
      </div>
    </section>
  );
}

export function PulpitSkeleton() {
  return (
    <div
      className="pulpit-page"
      aria-busy="true"
      aria-label="Ładowanie pulpitu"
    >
      <div className="page-header">
        {/* Real title and freshness line - the loaded header has the same height. */}
        <div>
          <h1>Pulpit</h1>
          <GbpFreshnessPlaceholder />
        </div>
        <div className="pulpit-header-actions">
          <span
            className="ui-skel"
            style={{ width: "9rem", height: "var(--btn-height-sm)" }}
          />
          <span
            className="ui-skel"
            style={{ width: "7rem", height: "var(--btn-height-sm)" }}
          />
        </div>
      </div>

      <KpiStripSkeleton />

      <div className="pulpit-grid">
        <div className="pulpit-main">
          <VisibilitySkeleton />

          <section className="pulpit-card pulpit-phrases">
            <CardHeadSkel leadWide="18rem" />
            <div className="ui-skel-stack" style={{ marginTop: 20, gap: 14 }}>
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="ui-skel-row"
                  style={{ padding: "10px 0", borderBottom: 0 }}
                >
                  <Bar w={i % 2 === 0 ? "12rem" : "9rem"} h="0.875rem" />
                  <Bar w="3rem" h="0.875rem" />
                  <Bar w="4rem" h="1.25rem" />
                  <Bar w="5.5rem" h="1.5rem" />
                </div>
              ))}
            </div>
            <span
              className="ui-skel"
              style={{
                width: "100%",
                height: "2.5rem",
                marginTop: "auto",
                borderRadius: "var(--radius-pill)",
              }}
            />
          </section>
        </div>

        <aside className="pulpit-side">
          <ImproveSkeleton />
          <section className="pulpit-card">
            <CardHeadSkel leadWide="11rem" />
            <div className="pulpit-action-list" aria-hidden>
              <ActionRowSkel />
              <ActionRowSkel />
            </div>
            <div className="pulpit-card-foot" aria-hidden>
              <span style={{ visibility: "hidden" }}>Zobacz wszystkie</span>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
