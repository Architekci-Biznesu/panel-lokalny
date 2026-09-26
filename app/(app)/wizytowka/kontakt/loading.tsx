import {
  FieldRowsSkel,
  TabHeadSkel,
} from "@/features/wizytowka/components/tab-skeletons";

export default function KontaktLoading() {
  return (
    <div className="wiz-stack" aria-busy="true" aria-label="Ładowanie kontaktu">
      <TabHeadSkel titleWidth="8rem" descWidth="22rem" />
      <FieldRowsSkel count={8} />
    </div>
  );
}
