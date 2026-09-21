"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Menu, X } from "lucide-react";
import { useState } from "react";
import { logoutAction } from "@/features/auth/actions";
import { navGroups } from "@/features/shell/nav-config";
import { ProfileSwitcher } from "@/features/shell/profile-switcher";

type ShellProps = {
  children: React.ReactNode;
  profiles: { id: string; name: string }[];
  activeProfileId: string | null;
  userName: string;
};

export function AppShell({
  children,
  profiles,
  activeProfileId,
  userName,
}: ShellProps) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="app-shell">
      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="sidebar-brand">
          <span className="sidebar-brand-mark">PL</span>
          <span className="sidebar-brand-name">Panel Lokalny</span>
        </div>

        <div className="profile-switcher">
          <ProfileSwitcher
            profiles={profiles}
            activeProfileId={activeProfileId}
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
          <p className="sidebar-user">{userName}</p>
          <form action={logoutAction}>
            <button type="submit" className="ui-btn ui-btn-ghost ui-btn-sm">
              <LogOut aria-hidden />
              Wyloguj
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
          <button
            type="button"
            className="icon-btn mobile-only"
            aria-label="Otwórz menu"
            onClick={() => setSidebarOpen(true)}
          >
            {sidebarOpen ? <X aria-hidden /> : <Menu aria-hidden />}
          </button>
          <p className="topbar-title">Panel Lokalny</p>
        </header>
        <main className="app-content">{children}</main>
      </div>
    </div>
  );
}
