"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  ArrowLeft,
  ChevronDown,
  ChevronsUpDown,
  Plus,
  Search,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { toast } from "gooey-toast";
import { exitAdminMode } from "@/features/admin/actions";
import {
  startFreshAddProfile,
  switchActiveProfile,
} from "@/features/onboarding/actions";

type ProfileOption = { id: string; name: string; location?: string | null };

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

  const filtered = useMemo(() => {
    const base =
      compact && activeProfileId
        ? profiles.filter((p) => p.id !== activeProfileId)
        : profiles;
    const q = query.trim().toLowerCase();
    if (!q) return base;
    return base.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.location ?? "").toLowerCase().includes(q),
    );
  }, [profiles, query, compact, activeProfileId]);

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
        onClick={toggleMenu}
        aria-expanded={open}
        disabled={busy}
      >
        {compact ? (
          <>
            Przełącz profil <ChevronDown aria-hidden width={14} height={14} />
          </>
        ) : variant === "navbar" ? (
          <>
            <span className="profile-nav-avatar" aria-hidden>
              {(active?.name ?? "?").trim().slice(0, 2).toUpperCase()}
            </span>
            <span className="profile-nav-name">
              {active?.name ?? "Brak profilu"}
            </span>
            <ChevronDown aria-hidden width={14} height={14} />
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
        <div className="profile-menu-panel" role="menu">
          {adminImpersonating ? (
            <p className="profile-menu-section">
              Profile klienta · {profiles.length}
            </p>
          ) : null}

          {!adminImpersonating ? (
            <div className="ui-search profile-menu-search">
              <Search aria-hidden className="ui-search-icon" />
              <input
                ref={searchRef}
                type="search"
                className="ui-field ui-search-input"
                placeholder="Szukaj profilu"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Szukaj profilu"
              />
            </div>
          ) : null}

          <div className="profile-menu-list">
            {filtered.length === 0 ? (
              <p className="profile-menu-empty">
                {compact && !query.trim()
                  ? "Brak innych profili"
                  : "Brak wyników"}
              </p>
            ) : (
              filtered.map((profile) => (
                <button
                  key={profile.id}
                  type="button"
                  className={
                    profile.id === activeProfileId
                      ? "profile-menu-option active"
                      : "profile-menu-option"
                  }
                  role="menuitem"
                  disabled={busy}
                  onClick={() => selectProfile(profile.id)}
                >
                  <span className="profile-menu-name">{profile.name}</span>
                  {profile.location ? (
                    <span className="profile-menu-loc">{profile.location}</span>
                  ) : null}
                </button>
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
                    <Plus aria-hidden />
                    Dodaj profil
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
