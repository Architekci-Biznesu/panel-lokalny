import { RegisterForm } from "@/features/auth/auth-forms";
import { SplitScreenLayout } from "@/features/shell/split-screen";

export default function RegisterPage() {
  return (
    <SplitScreenLayout
      hero={{
        headline: "Zacznij w kilka minut",
        description:
          "Załóż konto, zatwierdź brief od AI i wejdź do panelu bez zbędnych formularzy.",
        showTrustBar: true,
      }}
    >
      <h1>Rejestracja</h1>
      <p className="split-right-lead">
        Utwórz konto i przejdź przez krótki onboarding.
      </p>
      <RegisterForm />
    </SplitScreenLayout>
  );
}
