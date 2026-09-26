import {
  NapSkel,
  TabHeadSkel,
} from "@/features/wizytowka/components/tab-skeletons";

export default function NapLoading() {
  return (
    <div className="wiz-stack" aria-busy="true" aria-label="Ładowanie NAP">
      <TabHeadSkel titleWidth="11rem" descWidth="30rem" />
      <NapSkel />
    </div>
  );
}
