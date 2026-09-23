import {
  ServiceListSkel,
  TabHeadSkel,
} from "@/features/wizytowka/components/tab-skeletons";

export default function UslugiLoading() {
  return (
    <div className="wiz-stack" aria-busy="true" aria-label="Ładowanie usług">
      <TabHeadSkel titleWidth="5rem" descWidth="18rem" />
      <ServiceListSkel count={4} />
    </div>
  );
}
