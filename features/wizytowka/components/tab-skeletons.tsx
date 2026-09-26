// Szkielety ładowania zakładek Wizytówki - odwzorowują układ Stylu 4 (te same kontenery co widoki),
// żeby po załadowaniu treść nie "skakała". Klocki: .ui-skel* z styles/ui.css.

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

function TileSkel({ rows, titleWidth }: { rows: number; titleWidth: string }) {
  return (
    <div className="wiz-hours-tile">
      <div className="ui-skel-row" style={{ paddingTop: 0 }}>
        <Bar w={titleWidth} h="1.25rem" />
        <span className="ui-skel ui-skel-circle" />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="ui-skel-row">
          <Bar w="6rem" />
          <Bar w="5.5rem" />
        </div>
      ))}
    </div>
  );
}

/** Godziny otwarcia + Dni specjalne: dwa kafle obok siebie. */
export function HoursTilesSkel() {
  return (
    <div className="wiz-hours-row">
      <TileSkel rows={7} titleWidth="10rem" />
      <TileSkel rows={2} titleWidth="8rem" />
    </div>
  );
}

/** Lista usług (podgląd): nazwa + opis. */
export function ServiceListSkel({ count = 4 }: { count?: number }) {
  return (
    <div className="wiz-uslugi">
      <ul className="wiz-uslugi-list">
        {Array.from({ length: count }).map((_, i) => (
          <li key={i} className="wiz-uslugi-item">
            <div className="ui-skel-stack">
              <Bar w={i % 2 === 0 ? "14rem" : "10rem"} h="0.875rem" />
              <Bar w="45%" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Atrybuty: grupy jako kafle w dwóch kolumnach, wiersz = etykieta + segment Tak/Nie. */
export function AttrGroupsSkel({
  groups = [3, 2, 3, 2],
}: {
  groups?: number[];
}) {
  return (
    <div className="wiz-fields">
      <div className="wiz-attr-scroll">
        {groups.map((rows, g) => (
          <section key={g} className="wiz-attr-group">
            <div
              className="ui-skel-row"
              style={{ paddingTop: 0, borderBottom: 0 }}
            >
              <Bar w="7rem" h="1rem" />
            </div>
            {Array.from({ length: rows }).map((_, i) => (
              <div key={i} className="ui-skel-row">
                <Bar w={i % 2 === 0 ? "12rem" : "9rem"} />
                <Bar w="5.5rem" h="2rem" />
              </div>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}

/** NAP: lista katalogów + kafel statusu. */
export function NapSkel({ count = 6 }: { count?: number }) {
  return (
    <div className="wiz-nap-grid">
      <section className="wiz-nap-catalogs">
        <div className="ui-skel-row" style={{ paddingTop: 0 }}>
          <Bar w="6rem" h="1.25rem" />
          <Bar w="14rem" h="1.5rem" />
        </div>
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="ui-skel-row">
            <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span
                className="ui-skel ui-skel-block"
                style={{ width: 36, height: 36 }}
              />
              <span className="ui-skel-stack">
                <Bar w="8rem" h="0.875rem" />
                <Bar w="10rem" h="0.625rem" />
              </span>
            </span>
            <Bar w="6rem" h="1.5rem" />
          </div>
        ))}
      </section>
      <aside className="wiz-nap-cta">
        <div className="ui-skel-stack">
          <Bar w="4rem" h="1.5rem" />
          <Bar w="80%" h="1.25rem" />
          <Bar w="60%" />
          <span
            className="ui-skel"
            style={{ width: "100%", height: 44, marginTop: 24 }}
          />
        </div>
      </aside>
    </div>
  );
}

/** Raporty: 3 kafle KPI + 2 wykresy. */
export function ReportSkel() {
  return (
    <>
      <div className="wiz-report-summary">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="ui-kpi wiz-report-kpi">
            <div className="ui-skel-stack">
              <Bar w="55%" />
              <Bar w="35%" h="2.5rem" />
              <Bar w="100%" h="0.5rem" />
              <Bar w="100%" h="0.5rem" />
            </div>
          </div>
        ))}
      </div>
      <div className="wiz-report-charts">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="ui-kpi wiz-report-chart">
            <div className="ui-skel-stack">
              <Bar w="45%" h="1rem" />
              <span
                className="ui-skel ui-skel-block"
                style={{ width: "100%", height: "16rem", marginTop: 12 }}
              />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
