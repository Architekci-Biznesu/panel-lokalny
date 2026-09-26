import {
  FieldRowsSkel,
  HoursTilesSkel,
  TabHeadSkel,
} from "@/features/wizytowka/components/tab-skeletons";

export default function InformacjeLoading() {
  return (
    <div
      className="wiz-stack"
      aria-busy="true"
      aria-label="Ładowanie informacji"
    >
      <TabHeadSkel titleWidth="16rem" descWidth="24rem" />
      <FieldRowsSkel count={9} />
      <HoursTilesSkel />
    </div>
  );
}
