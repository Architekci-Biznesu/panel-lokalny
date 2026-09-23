import {
  AttrRowsSkel,
  TabHeadSkel,
} from "@/features/wizytowka/components/tab-skeletons";

export default function AtrybutyLoading() {
  return (
    <div className="wiz-stack" aria-busy="true" aria-label="Ładowanie atrybutów">
      <TabHeadSkel titleWidth="6rem" descWidth="18rem" />
      <div className="wiz-fields">
        <div className="wiz-attr-group">
          <div
            className="wiz-skel-line"
            style={{
              width: "6rem",
              height: "0.65rem",
              margin: "0.85rem 1.25rem 0.35rem",
            }}
          />
          <AttrRowsSkel count={5} />
        </div>
      </div>
    </div>
  );
}
