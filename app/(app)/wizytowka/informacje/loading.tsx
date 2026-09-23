import {
  FieldRowsSkel,
  HoursRowsSkel,
  TabHeadSkel,
} from "@/features/wizytowka/components/tab-skeletons";

export default function InformacjeLoading() {
  return (
    <div className="wiz-stack" aria-busy="true" aria-label="Ładowanie informacji">
      <TabHeadSkel titleWidth="11rem" descWidth="20rem" />
      <FieldRowsSkel count={9} />
      <div className="wiz-fields">
        <div className="wiz-field-row">
          <div
            className="wiz-skel-line"
            style={{ width: "5rem", height: "0.65rem", marginTop: "0.2rem" }}
          />
          <div
            className="wiz-skel-line"
            style={{ width: "40%", height: "0.85rem", marginTop: "0.15rem" }}
          />
        </div>
        <HoursRowsSkel count={7} />
      </div>
    </div>
  );
}
