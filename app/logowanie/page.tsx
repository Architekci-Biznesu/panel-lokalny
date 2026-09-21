import { LoginForm } from "@/features/auth/auth-forms";
import { SplitScreenLayout } from "@/features/shell/split-screen";

export default function LoginPage() {
  return (
    <SplitScreenLayout
      hero={{
        headline: "Panel dla lokalnych firm",
        description: "Wszystko, czego potrzebujesz, w jednym miejscu.",
        showTrustBar: true,
      }}
    >
      <h1>Logowanie</h1>
      <p className="split-right-lead">
        Zaloguj się, żeby zarządzać wizytówką, publikacjami i opiniami.
      </p>
      <LoginForm />
    </SplitScreenLayout>
  );
}
