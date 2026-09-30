// Szkielet Wizytówki przy pierwszym wejściu - odwzorowuje układ Stylu 4 (te same kontenery co widoki),
// żeby po załadowaniu treść nie "skakała". Klocki: .ui-skel* z styles/ui.css.

import { GbpFreshnessPlaceholder } from "@/features/wizytowka/components/gbp-freshness";

function Bar({ w, h = "0.75rem" }: { w: string; h?: string }) {
  return <span className="ui-skel" style={{ width: w, height: h }} />;
}

export function TabHeadSkel({
  titleWidth = "12rem",
  descWidth = "20rem",
}: {
  titleWidth?: string;
  descWidth?: string;
}) {
  return (
    <div className="wiz-tab-head">
      <div className="ui-skel-stack">
        <Bar w={titleWidth} h="1.75rem" />
        <Bar w={descWidth} h="0.875rem" />
      </div>
    </div>
  );
}

/** Kafel z wierszami pól: etykieta 180px | wartość | okrągły ołówek. */
export function FieldRowsSkel({ count = 5 }: { count?: number }) {
  return (
    <div className="wiz-fields">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="wiz-field-row">
          <Bar w="6rem" />
          <Bar w={i % 2 === 0 ? "60%" : "40%"} h="0.875rem" />
          <span className="ui-skel ui-skel-circle" />
        </div>
      ))}
    </div>
  );
}

/** Whole Wizytówka on first entry: header, preview card, tabs and the first tab. */
export function WizytowkaModuleSkel() {
  return (
    <div className="wiz-page" aria-busy="true" aria-label="Ładowanie wizytówki">
      <div className="page-header wiz-header">
        <div>
          <h1>Wizytówka Google</h1>
          <GbpFreshnessPlaceholder />
        </div>
      </div>
      <div className="wiz-top-row">
        <div className="wiz-preview-card">
          <span
            className="ui-skel ui-skel-block"
            style={{ width: "100%", minHeight: "13rem" }}
          />
          <div
            className="ui-skel-stack"
            style={{ padding: "20px 20px 20px 0" }}
          >
            <Bar w="70%" h="1.5rem" />
            <Bar w="30%" />
            <Bar w="45%" h="1.5rem" />
            <Bar w="90%" />
            <Bar w="80%" />
          </div>
        </div>
        <div className="wiz-complete-card">
          <div className="ui-skel-stack">
            <Bar w="8rem" h="1rem" />
            <Bar w="4rem" h="2rem" />
            <Bar w="100%" h="0.5rem" />
            <Bar w="85%" />
            <Bar w="70%" />
          </div>
        </div>
      </div>
      <nav className="ui-subnav" aria-hidden>
        {["5rem", "6rem", "4.5rem", "5rem", "5.5rem", "3rem"].map((w, i) => (
          <span key={i} className="ui-subnav-link">
            <Bar w={w} h="0.875rem" />
          </span>
        ))}
      </nav>
      <div className="wiz-tab-body">
        <div className="wiz-stack">
          <TabHeadSkel />
          <FieldRowsSkel count={6} />
        </div>
      </div>
    </div>
  );
}
