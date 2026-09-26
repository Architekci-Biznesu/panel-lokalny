import {
  ReportSkel,
  TabHeadSkel,
} from "@/features/wizytowka/components/tab-skeletons";

export default function RaportyLoading() {
  return (
    <div className="wiz-stack" aria-busy="true" aria-label="Ładowanie raportów">
      <TabHeadSkel titleWidth="14rem" descWidth="12rem" />
      <ReportSkel />
    </div>
  );
}
