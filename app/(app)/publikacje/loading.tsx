// Renderuje się wewnątrz layoutu Publikacji (nagłówek i zakładki już są).
export default function PublikacjeLoading() {
  return (
    <div
      className="pub-stack"
      aria-busy="true"
      aria-label="Ładowanie publikacji"
    >
      {[0, 1].map((i) => (
        <div key={i} className="ui-section">
          <div className="ui-skel-stack">
            <span
              className="ui-skel"
              style={{ width: "12rem", height: "1.25rem" }}
            />
            <span
              className="ui-skel"
              style={{ width: "100%", height: "0.75rem" }}
            />
            <span
              className="ui-skel"
              style={{ width: "85%", height: "0.75rem" }}
            />
            <span
              className="ui-skel"
              style={{ width: "60%", height: "0.75rem" }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
