"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "gooey-toast";
import { exitAdminMode } from "@/features/admin/actions";
import { switchActiveProfile } from "@/features/onboarding/actions";

type ProfileOption = { id: string; name: string };

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

  function selectProfile(profileId: string) {
    if (profileId === activeProfileId) {
      setOpen(false);
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
      router.refresh();
    });
  }

  return (
    <div className="profile-menu" ref={rootRef}>
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
            <span className="profile-switcher-label">
              Aktywny profil
              {adminImpersonating ? (
                <span className="ui-pill ui-pill-warn">admin</span>
              ) : null}
            </span>
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
              className={profile.id === activeProfileId ? "active" : undefined}
              role="menuitem"
              disabled={pending}
              onClick={() => selectProfile(profile.id)}
            >
              {profile.name}
            </button>
          ))}
          {!adminImpersonating ? (
            <Link
              href="/onboarding?mode=add"
              role="menuitem"
              onClick={() => setOpen(false)}
            >
              Dodaj profil
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
