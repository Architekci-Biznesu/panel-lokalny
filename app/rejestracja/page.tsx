import { RegisterForm } from "@/features/auth/auth-forms";
import { AuthAltTop, SplitScreenLayout } from "@/features/shell/split-screen";

export default function RegisterPage() {
  return (
    <SplitScreenLayout
      hero={{
        topic: "3 kroki, ok. 3 minuty",
        headline: "Zacznij w kilka minut",
        description:
          "Załóż konto, zatwierdź brief od AI i wejdź do panelu bez zbędnych formularzy.",
        decor: "register",
        showTrustBar: true,
      }}
      topRight={
        <AuthAltTop
          href="/logowanie"
          prompt="Masz już konto?"
          action="Zaloguj się"
        />
      }
    >
      <h1>Rejestracja</h1>
      <p className="split-right-lead">
        Utwórz konto i przejdź przez krótki onboarding.
      </p>
      <RegisterForm />
    </SplitScreenLayout>
  );
}
