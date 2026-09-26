// Wspólny szkielet przy przechodzeniu między modułami (navbar z app/(app)/layout.tsx zostaje).
// Nowy moduł może mieć własny, dokładniejszy loading.tsx w swoim folderze.
export default function AppLoading() {
  return (
    <div
      className="ui-skel-stack"
      aria-busy="true"
      aria-label="Ładowanie"
      style={{ gap: 28 }}
    >
      <div className="page-header">
        <div className="ui-skel-stack">
          <span
            className="ui-skel"
            style={{ width: "16rem", height: "2.5rem" }}
          />
          <span
            className="ui-skel"
            style={{ width: "24rem", maxWidth: "80vw", height: "0.875rem" }}
          />
        </div>
      </div>
      <div className="ui-skel-grid">
        {[0, 1].map((i) => (
          <div key={i} className="ui-card">
            <div className="ui-skel-stack">
              <span
                className="ui-skel"
                style={{ width: "40%", height: "1.25rem" }}
              />
              <span
                className="ui-skel ui-skel-block"
                style={{ width: "100%", height: "10rem", marginTop: 12 }}
              />
            </div>
          </div>
        ))}
      </div>
      <div className="ui-card">
        <div className="ui-skel-stack">
          <span
            className="ui-skel"
            style={{ width: "30%", height: "1.25rem" }}
          />
          <span className="ui-skel" style={{ width: "90%" }} />
          <span className="ui-skel" style={{ width: "75%" }} />
          <span className="ui-skel" style={{ width: "60%" }} />
        </div>
      </div>
    </div>
  );
}
