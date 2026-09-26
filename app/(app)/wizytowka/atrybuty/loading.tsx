import {
  AttrGroupsSkel,
  TabHeadSkel,
} from "@/features/wizytowka/components/tab-skeletons";

export default function AtrybutyLoading() {
  return (
    <div
      className="wiz-stack"
      aria-busy="true"
      aria-label="Ładowanie atrybutów"
    >
      <TabHeadSkel titleWidth="8rem" descWidth="26rem" />
      <AttrGroupsSkel />
    </div>
  );
}
