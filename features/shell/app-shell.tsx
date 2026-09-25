"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, LogOut, Menu, X } from "lucide-react";
import { useState } from "react";
import { logoutAction } from "@/features/auth/actions";
import { navGroups } from "@/features/shell/nav-config";
import { ProfileSwitcher } from "@/features/shell/profile-switcher";
import { ReanalyzeButton } from "@/features/wizytowka/components/reanalyze-button";

type ShellProps = {
  children: React.ReactNode;
  profiles: { id: string; name: string; location: string | null }[];
  activeProfileId: string | null;
  userName: string;
  userEmail: string | null;
  adminImpersonating?: boolean;
  ownerEmail?: string | null;
};

function pageLabelFromPath(pathname: string): string {
  for (const group of navGroups) {
    for (const item of group.items) {
      if (
        pathname === item.href ||
        pathname.startsWith(`${item.href}/`)
      ) {
        return item.label;
      }
    }
  }
  if (pathname.startsWith("/ustawienia")) return "Ustawienia";
  if (pathname.startsWith("/wizytowka")) return "Wizytówka Google";
  if (pathname.startsWith("/admin")) return "Admin";
  return "Panel";
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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pageLabel = pageLabelFromPath(pathname);
  const onWizytowka = pathname.startsWith("/wizytowka");

  return (
    <div className="app-shell">
      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="sidebar-brand">
          <span className="sidebar-brand-mark">PL</span>
          <div className="sidebar-brand-text">
            <span className="sidebar-brand-name">Panel Lokalny</span>
            <span className="sidebar-brand-sub">Panel klienta</span>
          </div>
        </div>

        <div className="profile-switcher">
          <ProfileSwitcher
            profiles={profiles}
            activeProfileId={activeProfileId}
            adminImpersonating={adminImpersonating}
            ownerEmail={ownerEmail}
          />
        </div>

        <nav className="sidebar-nav" aria-label="Główna nawigacja">
          {navGroups.map((group) => (
            <div key={group.label} className="nav-group">
              <p className="nav-group-label">{group.label}</p>
              <ul className="nav-list">
                {group.items.map((item) => {
                  const active =
                    pathname === item.href ||
                    pathname.startsWith(`${item.href}/`);
                  const Icon = item.icon;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={`nav-link ${active ? "active" : ""}`}
                        onClick={() => setSidebarOpen(false)}
                      >
                        <Icon aria-hidden />
                        <span>{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user-block">
            <p className="sidebar-user-name">{userName}</p>
            {userEmail ? (
              <p className="sidebar-user-email">{userEmail}</p>
            ) : null}
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              className="ui-btn ui-btn-ghost ui-btn-sm sidebar-logout"
              aria-label="Wyloguj"
            >
              <LogOut aria-hidden />
            </button>
          </form>
        </div>
      </aside>

      {sidebarOpen ? (
        <button
          type="button"
          className="sidebar-backdrop"
          aria-label="Zamknij menu"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}

      <div className="app-main">
        <header className="topbar">
          <div className="topbar-left">
            <button
              type="button"
              className="icon-btn mobile-only"
              aria-label="Otwórz menu"
              onClick={() => setSidebarOpen(true)}
            >
              {sidebarOpen ? <X aria-hidden /> : <Menu aria-hidden />}
            </button>
            <div className="topbar-crumbs">
              <p className="topbar-title">Panel</p>
              <p className="topbar-subtitle">{pageLabel}</p>
            </div>
          </div>
          <div className="topbar-right">
            {onWizytowka ? <div id="wiz-topbar-slot" /> : null}
            {onWizytowka ? (
              <Link
                href="/ustawienia/kontekst"
                className="ui-btn ui-btn-outline ui-btn-sm"
              >
                <ArrowUpRight aria-hidden />
                <span>Zaktualizuj kontekst firmy</span>
              </Link>
            ) : null}
            {onWizytowka ? <ReanalyzeButton /> : null}
          </div>
        </header>
        <main className="app-content app-canvas-dots">{children}</main>
      </div>
    </div>
  );
}
