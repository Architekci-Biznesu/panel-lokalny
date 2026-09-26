import {
  ServiceListSkel,
  TabHeadSkel,
} from "@/features/wizytowka/components/tab-skeletons";

export default function UslugiLoading() {
  return (
    <div className="wiz-stack" aria-busy="true" aria-label="Ładowanie usług">
      <TabHeadSkel titleWidth="7rem" descWidth="24rem" />
      <ServiceListSkel count={4} />
    </div>
  );
}
