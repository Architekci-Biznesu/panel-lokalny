"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  loginAction,
  registerAction,
  type ActionResult,
} from "@/features/auth/actions";
import { AuthAltLink } from "@/features/shell/split-screen";

const initial: ActionResult | null = null;

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, initial);

  return (
    <form action={action} className="auth-form">
      <div className="auth-field">
        <label htmlFor="email">E-mail</label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
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
          required
          className="ui-field"
        />
      </div>
      {state && !state.ok ? (
        <p className="auth-error" role="alert">
          {state.error}
        </p>
      ) : null}
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

  return (
    <form action={action} className="auth-form">
      <div className="auth-field">
        <label htmlFor="name">Imię i nazwisko</label>
        <input
          id="name"
          name="name"
          type="text"
          autoComplete="name"
          required
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
          required
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
          required
          minLength={8}
          className="ui-field"
        />
      </div>
      {state && !state.ok ? (
        <p className="auth-error" role="alert">
          {state.error}
        </p>
      ) : null}
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
