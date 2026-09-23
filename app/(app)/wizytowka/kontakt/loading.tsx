import {
  FieldRowsSkel,
  TabHeadSkel,
} from "@/features/wizytowka/components/tab-skeletons";

export default function KontaktLoading() {
  return (
    <div className="wiz-stack" aria-busy="true" aria-label="Ładowanie kontaktu">
      <TabHeadSkel titleWidth="6rem" descWidth="16rem" />
      <FieldRowsSkel count={2} />
    </div>
  );
}
