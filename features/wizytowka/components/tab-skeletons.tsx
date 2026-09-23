export function TabHeadSkel({
  titleWidth = "10rem",
  descWidth = "18rem",
}: {
  titleWidth?: string;
  descWidth?: string;
}) {
  return (
    <div className="wiz-tab-head">
      <div>
        <div
          className="wiz-skel-line"
          style={{ width: titleWidth, height: "1rem" }}
        />
        <div
          className="wiz-skel-line"
          style={{
            width: descWidth,
            height: "0.75rem",
            marginTop: "0.45rem",
          }}
        />
      </div>
    </div>
  );
}

export function FieldRowsSkel({ count = 5 }: { count?: number }) {
  return (
    <div className="wiz-fields">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="wiz-field-row">
          <div
            className="wiz-skel-line"
            style={{ width: "5rem", height: "0.65rem", marginTop: "0.2rem" }}
          />
          <div
            className="wiz-skel-line"
            style={{
              width: i % 2 === 0 ? "75%" : "50%",
              height: "1rem",
              marginTop: "0.15rem",
            }}
          />
        </div>
      ))}
    </div>
  );
}

export function ServiceListSkel({ count = 4 }: { count?: number }) {
  return (
    <ul className="wiz-uslugi-list">
      {Array.from({ length: count }).map((_, i) => (
        <li key={i} className="wiz-uslugi-item">
          <div
            className="wiz-skel-line"
            style={{ width: i % 2 === 0 ? "55%" : "40%", height: "0.9rem" }}
          />
          <div
            className="wiz-skel-line"
            style={{
              width: "80%",
              height: "0.7rem",
              marginTop: "0.4rem",
            }}
          />
        </li>
      ))}
    </ul>
  );
}

export function HoursRowsSkel({ count = 7 }: { count?: number }) {
  return (
    <ul className="wiz-hours-list">
      {Array.from({ length: count }).map((_, i) => (
        <li key={i} className="wiz-hours-row">
          <div
            className="wiz-skel-line"
            style={{ width: "5.5rem", height: "0.75rem" }}
          />
          <div
            className="wiz-skel-line"
            style={{ width: "6rem", height: "0.75rem" }}
          />
        </li>
      ))}
    </ul>
  );
}

export function AttrRowsSkel({ count = 3 }: { count?: number }) {
  return (
    <ul className="wiz-attr-list">
      {Array.from({ length: count }).map((_, i) => (
        <li key={i} className="wiz-attr-row">
          <div
            className="wiz-skel-line"
            style={{ width: "8rem", height: "0.75rem" }}
          />
          <div
            className="wiz-skel-line"
            style={{ width: "4rem", height: "0.75rem" }}
          />
        </li>
      ))}
    </ul>
  );
}

export function KpiGridSkel({ count = 6 }: { count?: number }) {
  return (
    <div className="wiz-kpi-grid">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="ui-kpi">
          <div
            className="wiz-skel-line"
            style={{ width: "70%", height: "0.75rem" }}
          />
          <div
            className="wiz-skel-line"
            style={{
              width: "40%",
              height: "1.5rem",
              marginTop: "0.65rem",
            }}
          />
        </div>
      ))}
    </div>
  );
}
