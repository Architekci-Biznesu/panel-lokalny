import {
  FieldRowsSkel,
  TabHeadSkel,
} from "@/features/wizytowka/components/tab-skeletons";

// Renderuje się WEWNĄTRZ app/(app)/wizytowka/layout.tsx (nagłówek, podgląd i zakładki już są),
// więc pokazuje tylko szkielet treści zakładki. Zakładki mają własne, dokładniejsze loading.tsx.
export default function WizytowkaLoading() {
  return (
    <div
      className="wiz-stack"
      aria-busy="true"
      aria-label="Ładowanie wizytówki"
    >
      <TabHeadSkel />
      <FieldRowsSkel count={6} />
    </div>
  );
}
