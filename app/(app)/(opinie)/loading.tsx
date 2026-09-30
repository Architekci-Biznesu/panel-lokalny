import { OpinieSkeleton } from "@/features/opinie/components/opinie-skeleton";

// First entry into Opinie. Above opinie/layout.tsx (route group), so switching
// tabs inside Opinie never shows it - the clicked tab shows a pending dot.
export default function OpinieLoading() {
  return <OpinieSkeleton />;
}
