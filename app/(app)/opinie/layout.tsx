import { ReviewsSubnav } from "@/features/opinie/components/reviews-subnav";
import { countPendingReviews } from "@/features/opinie/load-reviews";
import { getActiveProfile } from "@/lib/session";

export default async function OpinieLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getActiveProfile();
  const pendingCount = await countPendingReviews(profile);

  return (
    <div className="op-page">
      <div className="page-header">
        <div>
          <h1>Opinie</h1>
          <p>
            Opinie z wizytówki Google i gotowe odpowiedzi od AI - publikujesz
            jednym kliknięciem albo poprawiasz je sam
          </p>
        </div>
      </div>
      <ReviewsSubnav pendingCount={pendingCount} />
      <div className="op-body">{children}</div>
    </div>
  );
}
