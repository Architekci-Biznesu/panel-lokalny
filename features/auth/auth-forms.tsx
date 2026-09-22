"use client";

import { useActionState, useEffect } from "react";
import { toast } from "gooey-toast";
import {
  loginAction,
  registerAction,
  type ActionResult,
} from "@/features/auth/actions";
import { AuthAltLink } from "@/features/shell/split-screen";

const initial: ActionResult | null = null;

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, initial);

  useEffect(() => {
    if (state && !state.ok) {
      toast.error({
        title: "Nie udało się zalogować",
        description: state.error,
      });
    }
  }, [state]);

  return (
    <form action={action} className="auth-form" noValidate>
      <div className="auth-field">
        <label htmlFor="email">E-mail</label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          className="ui-field"
        />
      </div>
      <div className="auth-field">
        <label htmlFor="password">Hasło</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          className="ui-field"
        />
      </div>
      <button type="submit" className="ui-btn ui-btn-primary" disabled={pending}>
        {pending ? "Logowanie..." : "Zaloguj się"}
      </button>
      <AuthAltLink
        href="/rejestracja"
        prompt="Nie masz konta?"
        action="Zarejestruj się"
      />
    </form>
  );
}

export function RegisterForm() {
  const [state, action, pending] = useActionState(registerAction, initial);

  useEffect(() => {
    if (state && !state.ok) {
      toast.error({
        title: "Nie udało się utworzyć konta",
        description: state.error,
      });
    }
  }, [state]);

  return (
    <form action={action} className="auth-form" noValidate>
      <div className="auth-field">
        <label htmlFor="name">Imię i nazwisko</label>
        <input
          id="name"
          name="name"
          type="text"
          autoComplete="name"
          className="ui-field"
        />
      </div>
      <div className="auth-field">
        <label htmlFor="email">E-mail</label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          className="ui-field"
        />
      </div>
      <div className="auth-field">
        <label htmlFor="password">Hasło</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          className="ui-field"
        />
      </div>
      <button type="submit" className="ui-btn ui-btn-primary" disabled={pending}>
        {pending ? "Tworzenie konta..." : "Utwórz konto"}
      </button>
      <AuthAltLink
        href="/logowanie"
        prompt="Masz już konto?"
        action="Zaloguj się"
      />
    </form>
  );
}
