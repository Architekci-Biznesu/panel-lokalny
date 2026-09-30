import { PublikacjeSkeleton } from "@/features/publikacje/components/publikacje-skeleton";

// First entry into Publikacje. Above publikacje/layout.tsx (route group), so
// switching tabs never shows it - the clicked tab shows a pending dot.
export default function PublikacjeLoading() {
  return <PublikacjeSkeleton />;
}
