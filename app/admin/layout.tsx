import Link from "next/link";
import { LogOut } from "lucide-react";
import { logoutAction } from "@/features/auth/actions";
import { BrandLogo } from "@/features/shell/brand-logo";
import { auth } from "@/lib/auth";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  return (
    <div className="admin-shell">
      <header className="admin-topbar">
        <Link href="/admin" className="admin-brand">
          <BrandLogo />
          <span className="admin-brand-text">
            <span className="admin-brand-name">Panel Lokalny</span>
            <span className="admin-brand-sub">admin</span>
          </span>
        </Link>
        <div className="admin-topbar-user">
          {session?.user?.email ? (
            <span className="admin-topbar-email">{session.user.email}</span>
          ) : null}
          <form action={logoutAction}>
            <button type="submit" className="ui-btn ui-btn-ghost ui-btn-sm">
              <LogOut aria-hidden />
              Wyloguj
            </button>
          </form>
        </div>
      </header>
      <main className="admin-main">{children}</main>
    </div>
  );
}
