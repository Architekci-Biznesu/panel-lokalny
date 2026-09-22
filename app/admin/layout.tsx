import Link from "next/link";
import { LogOut } from "lucide-react";
import { logoutAction } from "@/features/auth/actions";
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
          <span className="sidebar-brand-mark">PL</span>
          <span>
            <strong>Panel Lokalny</strong>
            <span className="admin-brand-sub">admin</span>
          </span>
        </Link>
        <div className="admin-topbar-user">
          <span>{session?.user?.email ?? ""}</span>
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
