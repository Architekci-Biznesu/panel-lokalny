import { WizytowkaModuleSkel } from "@/features/wizytowka/components/tab-skeletons";

// Only for the first entry into Wizytówka. It sits above wizytowka/layout.tsx
// (route group), so switching tabs inside Wizytówka never shows it - the
// clicked tab shows a pending dot instead.
export default function WizytowkaLoading() {
  return <WizytowkaModuleSkel />;
}
