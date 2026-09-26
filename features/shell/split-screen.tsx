import Image from "next/image";
import Link from "next/link";
import { LogOut, Users } from "lucide-react";
import { logoutAction } from "@/features/auth/actions";
import { BrandLogo } from "@/features/shell/brand-logo";
import {
  SplitLeftCarousel,
  type CarouselSlide,
} from "@/features/shell/split-left-carousel";

export const AUTH_CAROUSEL_SLIDES: CarouselSlide[] = [
  {
    src: "/images/auth/carousel-1.png",
    alt: "Lokalny biznes - właścicielka salonu",
  },
  {
    src: "/images/auth/carousel-2.png",
    alt: "Lokalny biznes - właściciel piekarni",
  },
  {
    src: "/images/auth/carousel-3.png",
    alt: "Lokalny biznes - właścicielka kawiarni",
  },
];

export type SplitHero = {
  /** @deprecated Prefer images / AUTH_CAROUSEL_SLIDES */
  imageSrc?: string;
  imageAlt?: string;
  images?: CarouselSlide[];
  headline: string;
  description: string;
  step?: { current: number; total: number };
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

export function SplitScreenLayout({
  hero,
  children,
  topRight,
}: SplitScreenProps) {
  const slides: CarouselSlide[] =
    hero.images && hero.images.length > 0
      ? hero.images
      : hero.imageSrc
        ? [{ src: hero.imageSrc, alt: hero.imageAlt ?? "" }]
        : AUTH_CAROUSEL_SLIDES;

  return (
    <div className="split-screen">
      <aside className="split-left">
        <SplitLeftCarousel slides={slides} />
        <div className="split-left-overlay">
          <div className="split-left-copy">
            <BrandMark />
            <h2 className="split-headline">{hero.headline}</h2>
            <p className="split-desc">{hero.description}</p>

            {hero.showTrustBar ? (
              <div className="trust-bar">
                <span className="trust-item">
                  <Users aria-hidden className="trust-users-icon" />
                  +300 klientów
                </span>
                <span className="trust-sep" aria-hidden />
                <span className="trust-item">4.9/5 209 opinii</span>
                <span className="trust-logos">
                  <Image
                    src="/images/brand/google.png"
                    alt="Google"
                    width={46}
                    height={15}
                    className="trust-logo-google"
                  />
                  <span className="trust-trustindex">
                    <Image
                      src="/images/brand/trustindex.svg"
                      alt=""
                      width={14}
                      height={14}
                      className="trust-logo-trustindex"
                    />
                    Trustindex
                  </span>
                </span>
              </div>
            ) : null}
          </div>

          {hero.user ? (
            <div className="split-user-bar">
              <div>
                <p className="split-user-name">{hero.user.name}</p>
                <p className="split-user-email">{hero.user.email}</p>
              </div>
              <form action={logoutAction}>
                <button
                  type="submit"
                  className="split-logout"
                  aria-label="Wyloguj"
                >
                  <LogOut aria-hidden />
                </button>
              </form>
            </div>
          ) : null}
        </div>
      </aside>

      <section className="split-right" id="split-right">
        {topRight ? <div className="split-top-right">{topRight}</div> : null}
        <div className="split-right-inner">{children}</div>
      </section>
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
