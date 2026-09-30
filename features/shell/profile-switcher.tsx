"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronsUpDown,
  Plus,
  Search,
  SearchX,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { toast } from "@/lib/toast";
import { exitAdminMode } from "@/features/admin/actions";
import {
  startFreshAddProfile,
  switchActiveProfile,
} from "@/features/onboarding/actions";

type ProfileOption = {
  id: string;
  name: string;
  location?: string | null;
  groupId?: string | null;
  groupName?: string | null;
};

type ProfileListSection = {
  key: string;
  label: string | null;
  profiles: ProfileOption[];
};

function buildProfileSections(
  profiles: ProfileOption[],
  activeProfileId: string | null,
  query: string,
): ProfileListSection[] {
  const ordered = [...profiles].sort((a, b) => {
    if (a.id === activeProfileId) return -1;
    if (b.id === activeProfileId) return 1;
    return a.name.localeCompare(b.name, "pl");
  });
  const q = query.trim().toLowerCase();
  const filtered = !q
    ? ordered
    : ordered.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.location ?? "").toLowerCase().includes(q) ||
          (p.groupName ?? "").toLowerCase().includes(q),
      );

  const hasAnyGroup = filtered.some((p) => Boolean(p.groupName?.trim()));
  if (!hasAnyGroup) {
    return [{ key: "all", label: null, profiles: filtered }];
  }

  const byGroup = new Map<string, ProfileOption[]>();
  const ungrouped: ProfileOption[] = [];
  for (const profile of filtered) {
    const name = profile.groupName?.trim();
    if (!name) {
      ungrouped.push(profile);
      continue;
    }
    const key = profile.groupId ?? name;
    const list = byGroup.get(key) ?? [];
    list.push(profile);
    byGroup.set(key, list);
  }

  const sections: ProfileListSection[] = [...byGroup.entries()]
    .map(([key, list]) => ({
      key,
      label: list[0]?.groupName?.trim() || "Grupa",
      profiles: list,
    }))
    .sort((a, b) => (a.label ?? "").localeCompare(b.label ?? "", "pl"));

  if (ungrouped.length > 0) {
    sections.push({
      key: "ungrouped",
      label: "Bez grupy",
      profiles: ungrouped,
    });
  }

  return sections;
}

function initials(name: string | null | undefined) {
  return (name ?? "?").trim().slice(0, 2).toUpperCase();
}

/** Podświetla dopasowanie frazy (bez rozróżniania wielkości liter). */
function highlight(text: string, query: string): ReactNode {
  const q = query.trim();
  if (!q) return text;
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="profile-menu-mark">
        {text.slice(idx, idx + q.length)}
      </mark>
      {text.slice(idx + q.length)}
    </>
  );
}

function profileCountLabel(count: number) {
  if (count === 1) return "1 profil";
  if (count >= 2 && count <= 4) return `${count} profile`;
  return `${count} profili`;
}

export function ProfileSwitcher({
  profiles,
  activeProfileId,
  compact = false,
  adminImpersonating = false,
  ownerEmail = null,
  variant = "default",
}: {
  profiles: ProfileOption[];
  activeProfileId: string | null;
  compact?: boolean;
  /** "navbar" = pigułka w górnym pasku (styl 4). */
  variant?: "default" | "navbar";
  adminImpersonating?: boolean;
  ownerEmail?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [pendingProfileId, setPendingProfileId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const isOnboarding = pathname === "/onboarding";

  if (pendingProfileId !== null && pendingProfileId === activeProfileId) {
    setPendingProfileId(null);
  }

  const switching =
    pendingProfileId !== null && pendingProfileId !== activeProfileId;
  const busy = switching || pending;

  const active =
    profiles.find((p) => p.id === activeProfileId) ?? profiles[0] ?? null;

  const filteredSections = useMemo(
    () => buildProfileSections(profiles, activeProfileId, query),
    [profiles, query, activeProfileId],
  );
  const filteredCount = useMemo(
    () => filteredSections.reduce((sum, s) => sum + s.profiles.length, 0),
    [filteredSections],
  );

  useEffect(() => {
    function onDocClick(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        closeMenu();
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  useEffect(() => {
    if (!open) return;
    if (!adminImpersonating) {
      searchRef.current?.focus();
    }
  }, [open, adminImpersonating]);

  function closeMenu() {
    setOpen(false);
    setQuery("");
  }

  function toggleMenu() {
    if (open) closeMenu();
    else setOpen(true);
  }

  function clearSearch() {
    setQuery("");
    searchRef.current?.focus();
  }

  /** Klawiatura w panelu: strzałki po wierszach, Enter w wyszukiwarce wybiera pierwszy wynik, Esc zamyka. */
  function onPanelKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeMenu();
      triggerRef.current?.focus();
      return;
    }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") {
      const firstHit = filteredSections[0]?.profiles[0];
      if (
        event.key === "Enter" &&
        event.target === searchRef.current &&
        firstHit
      ) {
        event.preventDefault();
        selectProfile(firstHit.id);
      }
      return;
    }
    const rows = Array.from(
      listRef.current?.querySelectorAll<HTMLButtonElement>(
        ".profile-menu-option:not(:disabled)",
      ) ?? [],
    );
    if (rows.length === 0) return;
    event.preventDefault();
    const current = rows.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === "ArrowDown") {
      rows[
        current === -1 ? 0 : Math.min(current + 1, rows.length - 1)
      ]?.focus();
    } else if (current <= 0) {
      if (searchRef.current) searchRef.current.focus();
      else rows[0]?.focus();
    } else {
      rows[current - 1]?.focus();
    }
  }

  if (profiles.length === 0 || (compact && !activeProfileId)) {
    return null;
  }

  function goToSelectedProfile() {
    if (isOnboarding) {
      router.push("/pulpit");
      return;
    }
    router.refresh();
  }

  function selectProfile(profileId: string) {
    if (profileId === activeProfileId) {
      closeMenu();
      if (isOnboarding) {
        router.push("/pulpit");
      }
      return;
    }
    setPendingProfileId(profileId);
    startTransition(async () => {
      const result = await switchActiveProfile(profileId);
      if (!result.ok) {
        setPendingProfileId(null);
        toast.error({
          title: "Nie udało się przełączyć profilu",
          description: result.error,
        });
        return;
      }
      closeMenu();
      goToSelectedProfile();
    });
  }

  const triggerMeta = adminImpersonating
    ? `Tryb admina · ${ownerEmail?.trim() || "konto klienta"}`
    : `${profileCountLabel(profiles.length)}${
        active?.location ? ` · ${active.location}` : ""
      }`;

  return (
    <div
      className={
        compact || variant === "navbar"
          ? "profile-menu profile-menu-end"
          : "profile-menu"
      }
      ref={rootRef}
    >
      <button
        type="button"
        className={
          compact
            ? "profile-menu-trigger"
            : variant === "navbar"
              ? "profile-nav-trigger"
              : "profile-switcher-btn"
        }
        ref={triggerRef}
        onClick={toggleMenu}
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={busy}
      >
        {compact ? (
          <>
            Przełącz profil <ChevronDown aria-hidden width={14} height={14} />
          </>
        ) : variant === "navbar" ? (
          <>
            <span
              className={`profile-nav-avatar${adminImpersonating ? " is-admin" : ""}`}
              aria-hidden
            >
              {initials(active?.name)}
            </span>
            <span className="profile-nav-name">
              {active?.name ?? "Brak profilu"}
            </span>
            <ChevronDown
              aria-hidden
              width={14}
              height={14}
              className="profile-nav-chevron"
            />
          </>
        ) : (
          <>
            <span className="profile-switcher-copy">
              <span className="profile-switcher-value">
                {active?.name ?? "Brak profilu"}
              </span>
              <span className="profile-switcher-sub">{triggerMeta}</span>
            </span>
            <ChevronsUpDown className="profile-switcher-icon" aria-hidden />
          </>
        )}
      </button>

      {open ? (
        <div
          className="profile-menu-panel"
          role="menu"
          aria-label="Profile"
          onKeyDown={onPanelKeyDown}
        >
          {adminImpersonating ? (
            <div className="profile-menu-admin">
              <span className="profile-menu-admin-label">Tryb admina</span>
              {ownerEmail ? (
                <span className="profile-menu-admin-email mono">
                  {ownerEmail}
                </span>
              ) : null}
            </div>
          ) : (
            <div className="profile-menu-search-wrap">
              <label className="profile-menu-search">
                <Search aria-hidden />
                <input
                  ref={searchRef}
                  type="search"
                  placeholder="Szukaj profilu"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  aria-label="Szukaj profilu"
                />
                {query.trim() ? (
                  <span className="profile-menu-search-count mono">
                    {filteredCount}/{profiles.length}
                  </span>
                ) : null}
              </label>
            </div>
          )}

          {filteredCount > 0 || !query.trim() ? (
            <p className="profile-menu-section">
              <span>
                {adminImpersonating ? "Profile klienta" : "Twoje profile"}
              </span>
              <span className="mono">{filteredCount}</span>
            </p>
          ) : null}

          <div className="profile-menu-list" ref={listRef}>
            {filteredCount === 0 ? (
              query.trim() ? (
                <div className="profile-menu-empty">
                  <span className="profile-menu-empty-icon" aria-hidden>
                    <SearchX />
                  </span>
                  <p>Brak profilu „{query.trim()}”</p>
                  <button
                    type="button"
                    className="profile-menu-clear"
                    onClick={clearSearch}
                  >
                    Wyczyść wyszukiwanie
                  </button>
                </div>
              ) : (
                <p className="profile-menu-empty">Brak wyników</p>
              )
            ) : (
              filteredSections.map((section) => (
                <div key={section.key} className="profile-menu-group">
                  {section.label ? (
                    <p className="profile-menu-group-label">{section.label}</p>
                  ) : null}
                  {section.profiles.map((profile) => {
                    // Na onboarding/add nie zaznaczamy „skąd przyszedłeś” - to wybór, nie bieżący kontekst.
                    const isActive = !compact && profile.id === activeProfileId;
                    return (
                      <button
                        key={profile.id}
                        type="button"
                        className={
                          isActive
                            ? "profile-menu-option active"
                            : "profile-menu-option"
                        }
                        role="menuitemradio"
                        aria-checked={isActive}
                        disabled={busy}
                        onClick={() => selectProfile(profile.id)}
                      >
                        <span className="profile-menu-avatar" aria-hidden>
                          {initials(profile.name)}
                        </span>
                        <span className="profile-menu-copy">
                          <span className="profile-menu-name">
                            {highlight(profile.name, query)}
                          </span>
                          {profile.location ? (
                            <span className="profile-menu-loc">
                              {highlight(profile.location, query)}
                            </span>
                          ) : null}
                        </span>
                        {isActive ? (
                          <span className="profile-menu-check" aria-hidden>
                            <Check />
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>

          {adminImpersonating || !compact ? (
            <div className="profile-menu-foot">
              {adminImpersonating ? (
                <button
                  type="button"
                  role="menuitem"
                  className="profile-menu-admin-exit"
                  disabled={busy}
                  onClick={() => {
                    startTransition(async () => {
                      await exitAdminMode();
                    });
                  }}
                >
                  <ArrowLeft aria-hidden />
                  Wróć do panelu admina
                </button>
              ) : (
                <form action={startFreshAddProfile}>
                  <button
                    type="submit"
                    className="profile-menu-add"
                    role="menuitem"
                    disabled={busy}
                  >
                    <span className="profile-menu-add-icon" aria-hidden>
                      <Plus />
                    </span>
                    <span className="profile-menu-copy">
                      <span className="profile-menu-name">Dodaj profil</span>
                      <span className="profile-menu-loc">
                        Kolejna firma lub lokalizacja
                      </span>
                    </span>
                  </button>
                </form>
              )}
            </div>
          ) : null}
        </div>
      ) : null}

      {busy
        ? createPortal(
            <div
              className="app-profile-switch-overlay"
              role="status"
              aria-busy="true"
              aria-live="polite"
            >
              <div className="app-profile-switch-content">
                <svg
                  aria-hidden
                  className="app-profile-switch-spinner"
                  viewBox="0 0 50 50"
                >
                  <circle
                    className="app-profile-switch-track"
                    cx="25"
                    cy="25"
                    r="20"
                  />
                  <circle
                    className="app-profile-switch-arc"
                    cx="25"
                    cy="25"
                    r="20"
                  />
                </svg>
                <p className="app-profile-switch-label">
                  Przełączanie profilu…
                </p>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
