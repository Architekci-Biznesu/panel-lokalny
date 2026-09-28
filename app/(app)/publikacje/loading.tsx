// Renderuje się wewnątrz layoutu Publikacji (nagłówek i zakładki już są).
export default function PublikacjeLoading() {
  return (
    <div
      className="pub-stack"
      aria-busy="true"
      aria-label="Ładowanie publikacji"
    >
      <span
        className="ui-skel"
        style={{ width: "26rem", maxWidth: "100%", height: "2.5rem" }}
      />
      {[0, 1].map((i) => (
        <div key={i} className="pub-card pub-card-skeleton">
          <span className="ui-skel pub-card-skel-media" />
          <div className="pub-card-skel-body">
            <span
              className="ui-skel"
              style={{ width: "40%", height: "1.25rem" }}
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
