// Renderuje się wewnątrz layoutu Opinii (nagłówek i zakładki już są).
export default function OpinieLoading() {
  return (
    <div className="op-list" aria-busy="true" aria-label="Ładowanie opinii">
      {[0, 1, 2].map((i) => (
        <div key={i} className="op-card">
          <div className="op-card-head">
            <span
              className="ui-skel-circle"
              style={{ width: 40, height: 40 }}
            />
            <div className="op-author">
              <span
                className="ui-skel"
                style={{ width: "10rem", height: "0.875rem" }}
              />
              <span
                className="ui-skel"
                style={{ width: "6rem", height: "0.75rem" }}
              />
            </div>
          </div>
          <span
            className="ui-skel"
            style={{ width: "100%", height: "0.75rem" }}
          />
          <span
            className="ui-skel"
            style={{ width: "72%", height: "0.75rem" }}
          />
        </div>
      ))}
    </div>
  );
}
