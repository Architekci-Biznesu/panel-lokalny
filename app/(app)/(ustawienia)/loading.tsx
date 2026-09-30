import { UstawieniaSkeleton } from "@/features/ustawienia/ustawienia-skeleton";

// First entry into Ustawienia. Above ustawienia/layout.tsx (route group), so
// switching tabs never shows it - the clicked tab shows a pending dot.
export default function UstawieniaLoading() {
  return <UstawieniaSkeleton />;
}
