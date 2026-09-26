"use client";

import { useMemo, useState, useTransition } from "react";
import { ChevronDown, LogIn, Search } from "lucide-react";
import { toast } from "gooey-toast";
import {
  enterAdminAccount,
  enterAdminProfile,
  type AdminAccountRow,
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

export function AdminAccountsTable({
  accounts,
}: {
  accounts: AdminAccountRow[];
}) {
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [pending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return accounts;
    return accounts.filter((row) => {
      if (row.ownerEmail.toLowerCase().includes(q)) return true;
      return row.profiles.some((p) => p.name.toLowerCase().includes(q));
    });
  }, [accounts, query]);

  const autoExpandedIds = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return new Set<string>();
    const ids = new Set<string>();
    for (const row of filtered) {
      if (row.profiles.some((p) => p.name.toLowerCase().includes(q))) {
        ids.add(row.id);
      }
    }
    return ids;
  }, [filtered, query]);

  function isExpanded(accountId: string) {
    if (autoExpandedIds.has(accountId)) return true;
    return !!expanded[accountId];
  }

  function toggle(accountId: string) {
    if (autoExpandedIds.has(accountId)) return;
    setExpanded((prev) => ({ ...prev, [accountId]: !prev[accountId] }));
  }

  return (
    <section className="ui-section">
      <header className="ui-section-header">
        <div>
          <div className="admin-section-heading">
            <h2 className="ui-section-title">Konta klientów</h2>
            <span className="ui-pill ui-pill-neutral mono">
              {accounts.length}
            </span>
          </div>
          <p className="ui-section-desc">
            Wejdź w konto lub profil, żeby pomóc klientowi - bez proszenia o
            hasło.
          </p>
        </div>
        <div className="ui-search admin-accounts-search">
          <Search aria-hidden className="ui-search-icon" />
          <input
            type="search"
            className="ui-field ui-search-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Szukaj po e-mailu lub nazwie profilu"
            aria-label="Szukaj kont"
          />
        </div>
      </header>

      <div className="ui-section-body admin-table-body">
        <div className="admin-table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col" className="admin-col-toggle">
                  <span className="sr-only">Rozwiń</span>
                </th>
                <th scope="col">Właściciel</th>
                <th scope="col">Profile</th>
                <th scope="col">Rejestracja</th>
                <th scope="col">Ostatnia aktywność</th>
                <th scope="col">
                  <span className="sr-only">Akcje</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="admin-empty">
                    Brak kont pasujących do wyszukiwania.
                  </td>
                </tr>
              ) : (
                filtered.map((account) => {
                  const open = isExpanded(account.id);
                  return (
                    <AccountBlock
                      key={account.id}
                      account={account}
                      open={open}
                      pending={pending}
                      onToggle={() => toggle(account.id)}
                      onEnterAccount={() => {
                        startTransition(async () => {
                          const result = await enterAdminAccount(account.id);
                          if (result && !result.ok) {
                            toast.error({
                              title: "Nie udało się wejść",
                              description: result.error,
                            });
                          }
                        });
                      }}
                      onEnterProfile={(profileId) => {
                        startTransition(async () => {
                          const result = await enterAdminProfile(profileId);
                          if (result && !result.ok) {
                            toast.error({
                              title: "Nie udało się wejść",
                              description: result.error,
                            });
                          }
                        });
                      }}
                    />
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function AccountBlock({
  account,
  open,
  pending,
  onToggle,
  onEnterAccount,
  onEnterProfile,
}: {
  account: AdminAccountRow;
  open: boolean;
  pending: boolean;
  onToggle: () => void;
  onEnterAccount: () => void;
  onEnterProfile: (profileId: string) => void;
}) {
  return (
    <>
      <tr className="admin-account-row">
        <td>
          <button
            type="button"
            className="admin-expand-btn"
            aria-expanded={open}
            aria-label={open ? "Zwiń profile" : "Rozwiń profile"}
            onClick={onToggle}
          >
            <ChevronDown aria-hidden className={open ? "is-open" : undefined} />
          </button>
        </td>
        <td>
          <button type="button" className="admin-email-btn" onClick={onToggle}>
            {account.ownerEmail}
          </button>
        </td>
        <td className="mono">{account.profileCount}</td>
        <td className="mono">{formatDate(account.createdAt)}</td>
        <td className="mono">{formatDate(account.lastActiveAt)}</td>
        <td>
          <button
            type="button"
            className="ui-btn ui-btn-outline ui-btn-sm"
            disabled={pending || account.profileCount === 0}
            onClick={onEnterAccount}
          >
            <LogIn aria-hidden />
            Wejdź
          </button>
        </td>
      </tr>
      {open
        ? account.profiles.map((profile) => (
            <tr key={profile.id} className="admin-profile-row">
              <td />
              <td colSpan={2}>
                <div className="admin-profile-cell">
                  <span className="admin-profile-name">{profile.name}</span>
                  {profile.groupName ? (
                    <span className="admin-profile-meta">
                      Grupa: {profile.groupName}
                    </span>
                  ) : (
                    <span className="admin-profile-meta">Bez grupy</span>
                  )}
                </div>
              </td>
              <td className="mono">{formatDate(profile.createdAt)}</td>
              <td />
              <td>
                <button
                  type="button"
                  className="ui-btn ui-btn-outline ui-btn-sm"
                  disabled={pending}
                  onClick={() => onEnterProfile(profile.id)}
                >
                  <LogIn aria-hidden />
                  Wejdź
                </button>
              </td>
            </tr>
          ))
        : null}
      {open && account.profiles.length === 0 ? (
        <tr className="admin-profile-row">
          <td />
          <td colSpan={5} className="admin-empty">
            To konto nie ma jeszcze profili.
          </td>
        </tr>
      ) : null}
    </>
  );
}
