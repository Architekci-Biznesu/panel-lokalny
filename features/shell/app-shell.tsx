"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, LogOut, Menu, Settings, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { logoutAction } from "@/features/auth/actions";
import { BrandLogo } from "@/features/shell/brand-logo";
import {
  navGroups,
  topNavMore,
  topNavPrimary,
} from "@/features/shell/nav-config";
import { ProfileSwitcher } from "@/features/shell/profile-switcher";

type ShellProps = {
  children: React.ReactNode;
  profiles: {
    id: string;
    name: string;
    location: string | null;
    groupId?: string | null;
    groupName?: string | null;
  }[];
  activeProfileId: string | null;
  userName: string;
  userEmail: string | null;
  adminImpersonating?: boolean;
  ownerEmail?: string | null;
};

function isActive(pathname: string, item: { href: string; activeMatch?: string }): boolean {
  const match = item.activeMatch ?? item.href;
  return pathname === match || pathname.startsWith(`${match}/`);
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

/** Zamyka menu po kliknięciu poza nim albo Escape. */
function useDismiss(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);
  return ref;
}

export function AppShell({
  children,
  profiles,
  activeProfileId,
  userName,
  userEmail,
  adminImpersonating = false,
  ownerEmail = null,
}: ShellProps) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const moreRef = useDismiss(moreOpen, () => setMoreOpen(false));
  const accountRef = useDismiss(accountOpen, () => setAccountOpen(false));
  const moreActive = topNavMore.some((item) => isActive(pathname, item));

  function closeAll() {
    setDrawerOpen(false);
    setMoreOpen(false);
    setAccountOpen(false);
  }

  return (
    <div className="app-shell">
      <header className={`topnav${drawerOpen ? " is-drawer-open" : ""}`}>
        <div className="topnav-left">
          <button
            type="button"
            className="topnav-icon-btn topnav-burger"
            aria-label={drawerOpen ? "Zamknij menu" : "Otwórz menu"}
            aria-expanded={drawerOpen}
            onClick={() => setDrawerOpen((v) => !v)}
          >
            {drawerOpen ? <X aria-hidden /> : <Menu aria-hidden />}
          </button>
          <Link
            href="/pulpit"
            onClick={closeAll}
            className="topnav-brand"
            aria-label="Panel Lokalny by Architekci Biznesu - Pulpit"
          >
            <BrandLogo />
            <span className="topnav-brand-copy">
              <span className="topnav-brand-name">Panel Lokalny</span>
              <span className="topnav-brand-sub">by Architekci Biznesu</span>
            </span>
          </Link>

          <nav className="topnav-links" aria-label="Główna nawigacja">
            {topNavPrimary.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={closeAll}
                className={`topnav-link ${isActive(pathname, item) ? "active" : ""}`}
                aria-current={
                  isActive(pathname, item) ? "page" : undefined
                }
              >
                {item.shortLabel ?? item.label}
              </Link>
            ))}
            {topNavMore.length > 0 ? (
              <div className="topnav-more" ref={moreRef}>
                <button
                  type="button"
                  className={`topnav-link ${moreActive ? "active" : ""}`}
                  aria-haspopup="menu"
                  aria-expanded={moreOpen}
                  onClick={() => setMoreOpen((v) => !v)}
                >
                  Więcej
                  <ChevronDown aria-hidden className="topnav-chevron" />
                </button>
                {moreOpen ? (
                  <div className="topnav-menu" role="menu">
                    {topNavMore.map((item) => {
                      const Icon = item.icon;
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={closeAll}
                          role="menuitem"
                          className={`topnav-menu-item ${isActive(pathname, item) ? "active" : ""}`}
                        >
                          <Icon aria-hidden />
                          {item.label}
                        </Link>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            ) : null}
          </nav>
        </div>

        <div className="topnav-right">
          <div className="topnav-profile">
            <ProfileSwitcher
              profiles={profiles}
              activeProfileId={activeProfileId}
              adminImpersonating={adminImpersonating}
              ownerEmail={ownerEmail}
              variant="navbar"
            />
          </div>
          <div className="topnav-account" ref={accountRef}>
            <button
              type="button"
              className="topnav-avatar"
              aria-label={`Konto: ${userName}`}
              aria-haspopup="menu"
              aria-expanded={accountOpen}
              onClick={() => setAccountOpen((v) => !v)}
            >
              {initials(userName)}
            </button>
            {accountOpen ? (
              <div className="topnav-menu topnav-menu-end" role="menu">
                <div className="topnav-menu-user">
                  <span className="topnav-menu-user-name">{userName}</span>
                  {userEmail ? (
                    <span className="topnav-menu-user-email">{userEmail}</span>
                  ) : null}
                </div>
                <Link
                  href="/ustawienia"
                  onClick={closeAll}
                  role="menuitem"
                  className="topnav-menu-item"
                >
                  <Settings aria-hidden />
                  Ustawienia i plan
                </Link>
                <form action={logoutAction}>
                  <button
                    type="submit"
                    role="menuitem"
                    className="topnav-menu-item"
                  >
                    <LogOut aria-hidden />
                    Wyloguj
                  </button>
                </form>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      {drawerOpen ? (
        <>
          <button
            type="button"
            className="topnav-backdrop"
            aria-label="Zamknij menu"
            onClick={() => setDrawerOpen(false)}
          />
          <nav className="topnav-drawer" aria-label="Menu">
            {navGroups.map((group) => (
              <div key={group.label} className="topnav-drawer-group">
                <p className="topnav-drawer-label">{group.label}</p>
                {group.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={closeAll}
                      className={`topnav-menu-item ${isActive(pathname, item) ? "active" : ""}`}
                    >
                      <Icon aria-hidden />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>
        </>
      ) : null}

      <main className="app-content">{children}</main>
    </div>
  );
}
