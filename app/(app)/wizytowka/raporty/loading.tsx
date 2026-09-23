import {
  TabHeadSkel,
} from "@/features/wizytowka/components/tab-skeletons";

export default function RaportyLoading() {
  return (
    <div className="wiz-stack" aria-busy="true" aria-label="Ładowanie raportów">
      <TabHeadSkel titleWidth="11rem" descWidth="20rem" />
      <div className="wiz-report-summary">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="ui-kpi wiz-report-kpi">
            <div
              className="wiz-skel-line"
              style={{ width: "70%", height: "0.75rem" }}
            />
            <div
              className="wiz-skel-line"
              style={{
                width: "40%",
                height: "1.5rem",
                marginTop: "0.35rem",
              }}
            />
            <div
              className="wiz-skel-line"
              style={{
                width: "100%",
                height: "2.5rem",
                marginTop: "0.5rem",
              }}
            />
          </div>
        ))}
      </div>
      <div className="wiz-report-charts">
        <div className="ui-kpi wiz-report-chart">
          <div
            className="wiz-skel-line"
            style={{ width: "55%", height: "0.85rem" }}
          />
          <div
            className="wiz-skel-line"
            style={{
              width: "100%",
              height: "12rem",
              marginTop: "0.75rem",
            }}
          />
        </div>
        <div className="ui-kpi wiz-report-chart">
          <div
            className="wiz-skel-line"
            style={{ width: "45%", height: "0.85rem" }}
          />
          <div
            className="wiz-skel-line"
            style={{
              width: "100%",
              height: "12rem",
              marginTop: "0.75rem",
            }}
          />
        </div>
      </div>
    </div>
  );
}
