export default function WizytowkaLoading() {
  return (
    <div className="wiz-page" aria-busy="true" aria-label="Ładowanie wizytówki">
      <div className="page-header wiz-header">
        <div className="wiz-skel-line" style={{ width: "14rem", height: "1.75rem" }} />
        <div
          className="wiz-skel-line"
          style={{ width: "18rem", height: "0.85rem", marginTop: "0.4rem" }}
        />
      </div>

      <div className="wiz-profile-header">
        <div className="wiz-profile-left">
          <div className="wiz-profile-identity">
            <div className="wiz-skel-block" style={{ width: "4.5rem", height: "4.5rem" }} />
            <div style={{ flex: 1 }}>
              <div className="wiz-skel-line" style={{ width: "70%", height: "1rem" }} />
              <div
                className="wiz-skel-line"
                style={{ width: "5rem", height: "1.25rem", marginTop: "0.45rem" }}
              />
              <div
                className="wiz-skel-line"
                style={{ width: "55%", height: "0.75rem", marginTop: "0.4rem" }}
              />
            </div>
          </div>
          <div className="wiz-profile-tiles">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="wiz-skel-block" style={{ height: "2.25rem" }} />
            ))}
          </div>
        </div>
        <div className="wiz-profile-complete">
          <div className="wiz-skel-line" style={{ width: "60%", height: "0.65rem" }} />
          <div className="wiz-skel-line" style={{ width: "4rem", height: "1.5rem", marginTop: "0.35rem" }} />
          <div className="wiz-skel-block" style={{ height: "0.5rem", marginTop: "0.5rem" }} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem 1rem", marginTop: "0.75rem" }}>
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="wiz-skel-line" style={{ width: "90%", height: "0.7rem" }} />
            ))}
          </div>
        </div>
      </div>

      <div className="wiz-subnav">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="wiz-skel-line"
            style={{
              width: "5.5rem",
              height: "1.5rem",
              margin: "0.5rem 0.5rem 0.5rem 0",
            }}
          />
        ))}
      </div>

      <div className="wiz-tab-body">
        <div
          className="wiz-skel-line"
          style={{
            width: "40%",
            height: "1rem",
            marginBottom: "1rem",
          }}
        />
      </div>
    </div>
  );
}
