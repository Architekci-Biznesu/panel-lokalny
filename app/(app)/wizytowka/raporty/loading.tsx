import {
  KpiGridSkel,
  TabHeadSkel,
} from "@/features/wizytowka/components/tab-skeletons";

export default function RaportyLoading() {
  return (
    <div className="wiz-stack" aria-busy="true" aria-label="Ładowanie raportów">
      <TabHeadSkel titleWidth="11rem" descWidth="20rem" />
      <div className="wiz-tab-panel">
        <KpiGridSkel count={6} />
      </div>
    </div>
  );
}
