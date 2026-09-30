import { ReviewSettingsForm } from "@/features/opinie/components/review-settings-form";
import { loadReplyContext } from "@/features/opinie/reply-context";
import { reviewDeps } from "@/features/opinie/review-deps";
import { normalizeRatingInstructions } from "@/features/opinie/review-settings";
import { getActiveProfile } from "@/lib/session";

export default async function OpinieUstawieniaPage() {
  const profile = await getActiveProfile();
  const context = await loadReplyContext(profile, reviewDeps());

  return (
    <ReviewSettingsForm
      // key: after saving, the form starts from the stored values
      key={`${profile.id}:${profile.reviewMode}:${profile.reviewSignature ?? ""}:${profile.reviewReplyInstructions ?? ""}:${JSON.stringify(profile.reviewRatingInstructions ?? null)}:${profile.reviewPerspective}:${profile.reviewStyle}`}
      initialMode={profile.reviewMode}
      initialSignature={profile.reviewSignature ?? ""}
      initialInstructions={profile.reviewReplyInstructions ?? ""}
      initialPerspective={profile.reviewPerspective}
      initialStyle={profile.reviewStyle}
      initialRatingInstructions={
        normalizeRatingInstructions(profile.reviewRatingInstructions) ?? {}
      }
      promptContext={{
        businessName: context.businessName,
        brief: context.brief,
        avoid: context.avoid,
        phone: context.phone,
      }}
      autoSince={profile.reviewAutoSince?.toISOString() ?? null}
    />
  );
}
