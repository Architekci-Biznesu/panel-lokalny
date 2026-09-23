import { TabHeadSkel } from "@/features/wizytowka/components/tab-skeletons";

export default function NapLoading() {
  return (
    <div className="wiz-stack" aria-busy="true" aria-label="Ładowanie NAP">
      <TabHeadSkel titleWidth="9rem" descWidth="22rem" />
      <div className="wiz-tab-panel">
        <div className="wiz-nap-status">
          <div
            className="wiz-skel-line"
            style={{ width: "4rem", height: "1.25rem" }}
          />
          <div
            className="wiz-skel-line"
            style={{
              width: "85%",
              height: "0.85rem",
              marginTop: "0.65rem",
            }}
          />
        </div>
        <div
          className="wiz-skel-block"
          style={{ width: "14rem", height: "2.75rem" }}
        />
      </div>
    </div>
  );
}
