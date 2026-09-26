import { auth } from "@/lib/auth";
import {
  listPublishGroupsForAccount,
  listUngroupedProfilesForAccount,
  loadOnboardingState,
} from "@/features/onboarding/actions";
import { resolveSwitcherProfileId } from "@/lib/session";
import { OnboardingWizard } from "@/features/onboarding/onboarding-wizard";
import { ProfileSwitcher } from "@/features/shell/profile-switcher";
import { SplitScreenLayout } from "@/features/shell/split-screen";

const HERO_BY_STEP = {
  "1": {
    topic: "Firma",
    headline: "Zacznijmy od Twojej firmy",
    description:
      "Podaj stronę WWW albo krótki opis. Resztę briefu AI uzupełni za Ciebie.",
  },
  "2": {
    topic: "Brief od AI",
    headline: "Brief pod Twoją markę",
    description:
      "Usługi, ton, grupa docelowa i wyróżniki - fundament publikacji i odpowiedzi na opinie.",
  },
  "3": {
    topic: "Wizytówka Google",
    headline: "Prawie gotowe",
    description: "Połącz wizytówkę Google - albo pomiń i wróć do tego później.",
  },
} as const;

type PageProps = {
  searchParams: Promise<{ mode?: string; gbp?: string }>;
};

export default async function OnboardingPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const mode = params.mode === "add" ? "add" : "new";
  const session = await auth();
  const state = await loadOnboardingState(mode);
  const groups = await listPublishGroupsForAccount();
  const ungroupedProfiles = await listUngroupedProfilesForAccount();
  const step = (
    ["1", "2", "3"].includes(state.draft.step) ? state.draft.step : "1"
  ) as "1" | "2" | "3";
  const hero = HERO_BY_STEP[step];
  const activeProfileId = await resolveSwitcherProfileId(
    session?.user?.activeProfileId ?? null,
  );
  const showProfileSwitcher = state.profiles.length > 0 && !!activeProfileId;

  return (
    <SplitScreenLayout
      hero={{
        ...hero,
        user:
          !showProfileSwitcher && session?.user
            ? {
                name: session.user.name ?? "Użytkownik",
                email: session.user.email ?? "",
              }
            : null,
      }}
      topRight={
        showProfileSwitcher ? (
          <ProfileSwitcher
            profiles={state.profiles}
            activeProfileId={activeProfileId}
            compact
          />
        ) : null
      }
    >
      <OnboardingWizard
        key={`${state.draft.step}-${state.draft.services}-${state.draft.tone}-${state.draft.targetAudience}-${state.draft.differentiators}-${state.draft.hasConnection}`}
        mode={mode}
        draft={state.draft}
        groups={groups.map((g) => ({ id: g.id, name: g.name }))}
        ungroupedProfiles={ungroupedProfiles}
        gbpStatus={params.gbp}
      />
    </SplitScreenLayout>
  );
}
