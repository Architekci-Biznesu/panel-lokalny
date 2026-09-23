import { notFound } from "next/navigation";
import { AdminAccountsTable } from "@/features/admin/admin-accounts-table";
import { AdminNapRequests } from "@/features/admin/admin-nap-requests";
import {
  listAdminAccounts,
  listNapInterestRequests,
} from "@/features/admin/actions";
import { isCurrentUserStaff } from "@/lib/session";

export default async function AdminPage() {
  if (!(await isCurrentUserStaff())) {
    notFound();
  }

  const [accounts, napRequests] = await Promise.all([
    listAdminAccounts(),
    listNapInterestRequests(),
  ]);

  return (
    <div className="admin-page">
      <header className="page-header">
        <div>
          <p className="split-step">PANEL WEWNĘTRZNY</p>
          <h1>Panel wewnętrzny</h1>
          <p>
            Konta klientów i zgłoszenia - wejście bez hasła, tylko dla zespołu.
          </p>
        </div>
      </header>

      <AdminAccountsTable accounts={accounts} />
      <AdminNapRequests requests={napRequests} />
    </div>
  );
}
