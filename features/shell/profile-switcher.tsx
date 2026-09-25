"use client";

import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, Plus } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "gooey-toast";
import { exitAdminMode } from "@/features/admin/actions";
import {
  startFreshAddProfile,
  switchActiveProfile,
} from "@/features/onboarding/actions";

type ProfileOption = { id: string; name: string; location?: string | null };

export function ProfileSwitcher({
  profiles,
  activeProfileId,
  compact = false,
  adminImpersonating = false,
  ownerEmail = null,
}: {
  profiles: ProfileOption[];
  activeProfileId: string | null;
  compact?: boolean;
  adminImpersonating?: boolean;
  ownerEmail?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const rootRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const isOnboarding = pathname === "/onboarding";

  const active =
    profiles.find((p) => p.id === activeProfileId) ?? profiles[0] ?? null;

  useEffect(() => {
    function onDocClick(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

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
      setOpen(false);
      // From onboarding, even the already-active profile must leave the wizard.
      if (isOnboarding) {
        router.push("/pulpit");
      }
      return;
    }
    startTransition(async () => {
      const result = await switchActiveProfile(profileId);
      if (!result.ok) {
        toast.error({
          title: "Nie udało się przełączyć profilu",
          description: result.error,
        });
        return;
      }
      setOpen(false);
      goToSelectedProfile();
    });
  }

  return (
    <div
      className={compact ? "profile-menu profile-menu-end" : "profile-menu"}
      ref={rootRef}
    >
      <button
        type="button"
        className={compact ? "profile-menu-trigger" : "profile-switcher-btn"}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        disabled={pending}
      >
        {compact ? (
          <>
            Przełącz profil <ChevronDown aria-hidden width={14} height={14} />
          </>
        ) : (
          <>
            {adminImpersonating ? (
              <span className="profile-switcher-label">
                <span className="ui-pill ui-pill-warn">admin</span>
              </span>
            ) : null}
            <span className="profile-switcher-value">
              {active?.name ?? "Brak profilu"}
            </span>
            {adminImpersonating && ownerEmail ? (
              <span className="profile-switcher-sub">{ownerEmail}</span>
            ) : null}
            <ChevronDown className="profile-switcher-icon" aria-hidden />
          </>
        )}
      </button>

      {open ? (
        <div className="profile-menu-panel" role="menu">
          {adminImpersonating ? (
            <button
              type="button"
              role="menuitem"
              className="profile-menu-admin-exit"
              disabled={pending}
              onClick={() => {
                startTransition(async () => {
                  await exitAdminMode();
                });
              }}
            >
              Wróć do panelu admina
            </button>
          ) : null}
          {profiles.map((profile) => (
            <button
              key={profile.id}
              type="button"
              className={
                profile.id === activeProfileId
                  ? "profile-menu-option active"
                  : "profile-menu-option"
              }
              role="menuitem"
              disabled={pending}
              onClick={() => selectProfile(profile.id)}
            >
              <span className="profile-menu-name">{profile.name}</span>
              {profile.location ? (
                <span className="profile-menu-loc">{profile.location}</span>
              ) : null}
            </button>
          ))}
          {!adminImpersonating ? (
            <form action={startFreshAddProfile}>
              <button
                type="submit"
                className="profile-menu-add"
                role="menuitem"
                disabled={pending}
              >
                <Plus aria-hidden />
                Dodaj profil
              </button>
            </form>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
