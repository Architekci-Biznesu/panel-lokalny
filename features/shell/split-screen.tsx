import Image from "next/image";
import Link from "next/link";
import { LogOut, Sparkles } from "lucide-react";
import { logoutAction } from "@/features/auth/actions";
import { BrandLogo } from "@/features/shell/brand-logo";
import {
  SplitHeroDecor,
  type SplitDecorVariant,
} from "@/features/shell/split-hero-decor";

const HERO_IMAGE = {
  src: "/images/auth/lokalny-przedsiebiorca.jpg",
  alt: "Lokalny przedsiębiorca",
};

export type SplitHero = {
  topic?: string;
  headline: string;
  description: string;
  decor?: SplitDecorVariant;
  showTrustBar?: boolean;
  user?: { name: string; email: string } | null;
};

type SplitScreenProps = {
  hero: SplitHero;
  children: React.ReactNode;
  topRight?: React.ReactNode;
};

function BrandMark() {
  return (
    <div className="split-brand">
      <BrandLogo />
      <div>
        <p className="split-brand-name">Panel Lokalny</p>
        <p className="split-brand-sub">by Architekci Biznesu</p>
      </div>
    </div>
  );
}

function userInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

function FormUserChip({
  user,
}: {
  user: { name: string; email: string };
}) {
  return (
    <div className="split-form-user">
      <div className="split-form-user-text">
        <p className="split-form-user-name">{user.name}</p>
        <p className="split-form-user-email mono">{user.email}</p>
      </div>
      <span className="split-form-user-avatar" aria-hidden>
        {userInitials(user.name)}
      </span>
      <form action={logoutAction}>
        <button type="submit" className="split-logout" aria-label="Wyloguj">
          <LogOut aria-hidden />
        </button>
      </form>
    </div>
  );
}

function TrustBar() {
  return (
    <div className="trust-bar">
      <span className="trust-avatars" aria-hidden>
        <span className="trust-avatar" />
        <span className="trust-avatar" />
        <span className="trust-avatar" />
      </span>
      <span className="trust-item">
        <span className="mono">+300</span> klientów
      </span>
      <span className="trust-sep" aria-hidden />
      <span className="trust-item">
        <span className="mono">4.9/5</span> · <span className="mono">209</span>{" "}
        opinii Google
      </span>
    </div>
  );
}

export function SplitScreenLayout({
  hero,
  children,
  topRight,
}: SplitScreenProps) {
  const headerRight =
    topRight || hero.user ? (
      <div className="split-top-right-stack">
        {topRight}
        {hero.user ? <FormUserChip user={hero.user} /> : null}
      </div>
    ) : null;

  return (
    <div className="split-screen">
      <section className="split-right" id="split-right">
        <header className="split-form-top">
          <BrandMark />
          {headerRight ? (
            <div className="split-top-right">{headerRight}</div>
          ) : null}
        </header>
        <div className="split-form-body">
          <div className="split-right-inner">{children}</div>
        </div>
        <footer className="split-form-foot">
          <span>© {new Date().getFullYear()} Architekci Biznesu</span>
          <span className="split-form-foot-links">
            <a href="#">Regulamin</a>
            <a href="#">Polityka prywatności</a>
          </span>
        </footer>
      </section>

      <aside className="split-left">
        <div className="split-left-media">
          <Image
            src={HERO_IMAGE.src}
            alt={HERO_IMAGE.alt}
            fill
            priority
            className="split-left-image"
            sizes="(max-width: 900px) 100vw, 50vw"
          />
        </div>
        <div className="split-hero-tint" aria-hidden />
        <div className="split-left-overlay">
          <div className="split-left-copy">
            {hero.topic ? (
              <span className="split-topic-pill">
                <Sparkles aria-hidden />
                {hero.topic}
              </span>
            ) : null}
            <h2 className="split-headline">{hero.headline}</h2>
            <p className="split-desc">{hero.description}</p>
          </div>

          {hero.decor ? <SplitHeroDecor variant={hero.decor} /> : null}

          <div className="split-left-bottom">
            {hero.showTrustBar ? <TrustBar /> : null}
          </div>
        </div>
      </aside>
    </div>
  );
}

export function AuthAltLink({
  href,
  prompt,
  action,
}: {
  href: string;
  prompt: string;
  action: string;
}) {
  return (
    <p className="auth-alt">
      {prompt} <Link href={href}>{action}</Link>
    </p>
  );
}

export function AuthAltTop({
  href,
  prompt,
  action,
}: {
  href: string;
  prompt: string;
  action: string;
}) {
  return (
    <p className="auth-alt auth-alt-top">
      <span>{prompt}</span>
      <Link href={href} className="ui-btn ui-btn-secondary ui-btn-sm">
        {action}
      </Link>
    </p>
  );
}
