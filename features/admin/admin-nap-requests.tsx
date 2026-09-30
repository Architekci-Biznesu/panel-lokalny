"use client";

import { useTransition } from "react";
import { LogIn } from "lucide-react";
import { toast } from "@/lib/toast";
import {
  enterAdminProfile,
  type AdminNapInterestRow,
} from "@/features/admin/actions";

function formatDate(value: Date | string | null): string {
  if (!value) return "-";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("pl-PL", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function AdminNapRequests({
  requests,
}: {
  requests: AdminNapInterestRow[];
}) {
  const [pending, startTransition] = useTransition();

  return (
    <section className="ui-section">
      <header className="ui-section-header">
        <div>
          <div className="admin-section-heading">
            <h2 className="ui-section-title">Zgłoszenia NAP</h2>
            <span className="ui-pill ui-pill-neutral mono">
              {requests.length}
            </span>
          </div>
          <p className="ui-section-desc">
            Zainteresowanie dodatkowymi wpisami w katalogach zewnętrznych.
          </p>
        </div>
      </header>
      <div className="ui-section-body admin-table-body">
        <div className="admin-table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Data</th>
                <th scope="col">Właściciel</th>
                <th scope="col">Profil</th>
                <th scope="col">
                  <span className="sr-only">Akcje</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {requests.length === 0 ? (
                <tr>
                  <td colSpan={4} className="admin-empty">
                    Brak zgłoszeń.
                  </td>
                </tr>
              ) : (
                requests.map((row) => (
                  <tr key={row.id} className="admin-account-row">
                    <td className="mono">{formatDate(row.createdAt)}</td>
                    <td>{row.ownerEmail}</td>
                    <td>{row.profileName}</td>
                    <td>
                      <button
                        type="button"
                        className="ui-btn ui-btn-outline ui-btn-sm"
                        disabled={pending}
                        onClick={() => {
                          startTransition(async () => {
                            const result = await enterAdminProfile(
                              row.profileId,
                            );
                            if (result && !result.ok) {
                              toast.error({
                                title: "Nie udało się wejść",
                                description: result.error,
                              });
                            }
                          });
                        }}
                      >
                        <LogIn aria-hidden />
                        Wejdź
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
