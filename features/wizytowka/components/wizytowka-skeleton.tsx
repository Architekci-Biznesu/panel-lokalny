import { GbpFreshnessPlaceholder } from "@/features/wizytowka/components/gbp-freshness";
import { WIZ_TABS } from "@/features/wizytowka/proposal-meta";
import { ModuleHeader } from "@/features/shell/module-header";
import {
  Skel,
  SkelButton,
  SkelCircle,
  SkelSubnav,
  SkelText,
} from "@/features/shell/skeleton";

// Heights below match the loaded blocks (measured at 1440 px), so the page
// does not jump when data arrives.

/** Raporty (the first tab): heading with dates, 3 KPI tiles, 2 charts. */
function RaportySkel() {
  return (
    <div className="wiz-stack">
      <div className="wiz-tab-head">
        <div className="wiz-tab-head-text">
          <h2>Raporty wizytówki</h2>
          <p className="mono">
            <SkelText w="11rem" />
          </p>
        </div>
        <SkelButton w="14rem" />
      </div>
      <div className="wiz-report-summary">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="ui-kpi wiz-report-kpi"
            style={{ minHeight: 244 }}
          >
            <Skel w="9rem" />
            <Skel w="5rem" h="2.5rem" />
            <Skel w="100%" h="0.5rem" />
            <Skel w="100%" h="0.5rem" />
          </div>
        ))}
      </div>
      <div className="wiz-report-charts">
        {[0, 1].map((i) => (
          <section key={i} className="ui-kpi wiz-report-chart">
            <Skel w="45%" h="1rem" />
            <Skel w="100%" h={256} block style={{ marginTop: 12 }} />
          </section>
        ))}
      </div>
    </div>
  );
}

/** Whole Wizytówka on first entry: header, preview, proposals, tabs, Raporty. */
export function WizytowkaModuleSkel() {
  return (
    <div className="wiz-page" aria-busy="true" aria-label="Ładowanie wizytówki">
      <ModuleHeader
        title="Wizytówka Google"
        className="wiz-header"
        below={<GbpFreshnessPlaceholder />}
        actions={
          <div className="wiz-header-actions">
            <SkelButton w="9.5rem" h={40} />
            <div className="wiz-reanalyze">
              <SkelButton w="13rem" h={40} />
              <p className="wiz-last-analysis">
                <SkelText w="12rem" />
              </p>
            </div>
          </div>
        }
      />

      <div className="wiz-top-row">
        <div className="wiz-preview-card" style={{ minHeight: 259 }}>
          <Skel w="100%" h="100%" block style={{ borderRadius: 0 }} />
          <div
            className="ui-skel-stack"
            style={{ padding: "20px 20px 20px 0" }}
          >
            <Skel w="75%" h="1.5rem" />
            <Skel w="30%" />
            <Skel w="45%" h="1.5rem" />
            <Skel w="90%" style={{ marginTop: "auto" }} />
            <Skel w="80%" />
          </div>
        </div>
        <div className="wiz-complete-card">
          <Skel w="9rem" h="1rem" />
          <Skel w="100%" h={28} />
          <div className="ui-skel-stack" style={{ gap: 14 }}>
            {[0, 1, 2, 3, 4].map((i) => (
              <Skel key={i} w="80%" h="0.875rem" />
            ))}
          </div>
        </div>
      </div>

      <div className="wiz-proposals">
        <div className="wiz-proposals-head">
          <div className="wiz-proposals-heading">
            <p className="wiz-proposals-title">Do Twojej decyzji</p>
          </div>
          <div className="wiz-proposals-actions">
            <SkelButton w="9.5rem" small />
            <SkelButton w="10rem" small />
          </div>
        </div>
        <ul className="wiz-proposals-grid">
          {[0, 1, 2].map((i) => (
            <li
              key={i}
              className="wiz-proposal-card"
              style={{ minHeight: 218 }}
            >
              <SkelCircle size={44} />
              <Skel w="50%" h="1.125rem" style={{ marginTop: 8 }} />
              <Skel w="100%" />
              <Skel w="85%" />
              <Skel w="100%" h={52} style={{ marginTop: "auto" }} />
            </li>
          ))}
        </ul>
      </div>

      <SkelSubnav tabs={WIZ_TABS} />
      <div className="wiz-tab-body">
        <RaportySkel />
      </div>
    </div>
  );
}
