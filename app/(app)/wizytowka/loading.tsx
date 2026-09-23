export default function WizytowkaLoading() {
  return (
    <div className="wiz-page" aria-busy="true" aria-label="Ładowanie wizytówki">
      <div className="wiz-header">
        <div className="wiz-skel-block" style={{ width: "14rem", height: "1.75rem" }} />
        <div className="wiz-skel-block" style={{ width: "9rem", height: "2.25rem" }} />
      </div>

      <div className="wiz-preview-card wiz-skel-card">
        <div className="wiz-skel-cover" />
        <div className="wiz-preview-body">
          <div className="wiz-skel-line" style={{ width: "55%", height: "1.25rem" }} />
          <div className="wiz-skel-line" style={{ width: "30%", height: "0.75rem" }} />
          <div className="wiz-skel-line" style={{ width: "70%", height: "0.75rem" }} />
          <div className="wiz-skel-line" style={{ width: "45%", height: "0.75rem" }} />
        </div>
      </div>

      <div className="wiz-completeness">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="wiz-completeness-item">
            <div className="wiz-skel-line" style={{ width: "3rem", height: "1rem" }} />
            <div className="wiz-skel-line" style={{ width: "5rem", height: "0.65rem" }} />
          </div>
        ))}
      </div>

      <div className="wiz-subnav">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="wiz-skel-line"
            style={{ width: "5.5rem", height: "1.5rem", margin: "0.5rem 0.5rem 0.5rem 0" }}
          />
        ))}
      </div>

      <div className="ui-section wiz-tab-body">
        <div className="wiz-skel-line" style={{ width: "40%", height: "1rem", marginBottom: "1rem" }} />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="wiz-field-row">
            <div className="wiz-field-main" style={{ width: "100%" }}>
              <div className="wiz-skel-line" style={{ width: "6rem", height: "0.65rem" }} />
              <div
                className="wiz-skel-line"
                style={{ width: i % 2 === 0 ? "75%" : "50%", height: "1rem", marginTop: "0.4rem" }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
