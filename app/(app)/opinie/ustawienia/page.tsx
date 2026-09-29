import { ReviewSettingsForm } from "@/features/opinie/components/review-settings-form";
import { getActiveProfile } from "@/lib/session";

export default async function OpinieUstawieniaPage() {
  const profile = await getActiveProfile();

  return (
    <ReviewSettingsForm
      // key: after saving, the form starts from the stored values
      key={`${profile.id}:${profile.reviewMode}:${profile.reviewSignature ?? ""}:${profile.reviewReplyInstructions ?? ""}`}
      initialMode={profile.reviewMode}
      initialSignature={profile.reviewSignature ?? ""}
      initialInstructions={profile.reviewReplyInstructions ?? ""}
      autoSince={profile.reviewAutoSince?.toISOString() ?? null}
    />
  );
}
