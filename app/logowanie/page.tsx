import { LoginForm } from "@/features/auth/auth-forms";
import { AuthAltTop, SplitScreenLayout } from "@/features/shell/split-screen";

export default function LoginPage() {
  return (
    <SplitScreenLayout
      hero={{
        topic: "Panel dla lokalnych firm",
        headline: "Wszystko, czego potrzebujesz, w jednym miejscu.",
        description:
          "Strona WWW, wizytówka Google, publikacje, opinie i kampanie SMS/e-mail - AI przygotowuje, Ty akceptujesz.",
        showTrustBar: true,
      }}
      topRight={
        <AuthAltTop
          href="/rejestracja"
          prompt="Nie masz konta?"
          action="Zarejestruj się"
        />
      }
    >
      <h1>Logowanie</h1>
      <p className="split-right-lead">
        Zaloguj się, żeby zarządzać stroną, wizytówką, publikacjami i
        kampaniami.
      </p>
      <LoginForm />
    </SplitScreenLayout>
  );
}
