import { ReviewsSubnav } from "@/features/opinie/components/reviews-subnav";
import { countPendingReviews } from "@/features/opinie/load-reviews";
import { getActiveProfile } from "@/lib/session";
import { ModuleHeader } from "@/features/shell/module-header";
import { OPINIE_HEADER } from "@/features/opinie/module";

export default async function OpinieLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getActiveProfile();
  const pendingCount = await countPendingReviews(profile);

  return (
    <div className="op-page">
      <ModuleHeader {...OPINIE_HEADER} />
      <ReviewsSubnav pendingCount={pendingCount} />
      <div className="op-body">{children}</div>
    </div>
  );
}
