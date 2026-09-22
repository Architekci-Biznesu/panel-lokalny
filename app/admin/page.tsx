import { notFound } from "next/navigation";
import { AdminAccountsTable } from "@/features/admin/admin-accounts-table";
import { listAdminAccounts } from "@/features/admin/actions";
import { isCurrentUserStaff } from "@/lib/session";

export default async function AdminPage() {
  if (!(await isCurrentUserStaff())) {
    notFound();
  }

  const accounts = await listAdminAccounts();

  return (
    <div className="admin-page">
      <header className="admin-page-header">
        <div>
          <p className="split-step">PANEL WEWNĘTRZNY</p>
          <h1>Konta klientów</h1>
          <p className="admin-page-lead">
            Wejdź w konto lub profil, żeby pomóc klientowi - bez proszenia o
            hasło.
          </p>
        </div>
      </header>

      <section className="ui-section admin-page-section">
        <AdminAccountsTable accounts={accounts} />
      </section>
    </div>
  );
}
