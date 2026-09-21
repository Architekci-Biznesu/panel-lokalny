"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { switchActiveProfile } from "@/features/onboarding/actions";

type ProfileOption = { id: string; name: string };

export function ProfileSwitcher({
  profiles,
  activeProfileId,
  compact = false,
}: {
  profiles: ProfileOption[];
  activeProfileId: string | null;
  compact?: boolean;
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

  // Onboarding / first visit: hide until the user already has at least one profile
  if (profiles.length === 0 || (compact && !activeProfileId)) {
    return null;
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
            <span className="profile-switcher-label">Aktywny profil</span>
            <span className="profile-switcher-value">
              {active?.name ?? "Brak profilu"}
            </span>
            <ChevronDown className="profile-switcher-icon" aria-hidden />
          </>
        )}
      </button>

      {open ? (
        <div className="profile-menu-panel" role="menu">
          {profiles.map((profile) => (
            <button
              key={profile.id}
              type="button"
              className={profile.id === active?.id ? "active" : undefined}
              role="menuitem"
              onClick={() => {
                startTransition(async () => {
                  await switchActiveProfile(profile.id);
                  setOpen(false);
                  router.refresh();
                });
              }}
            >
              {profile.name}
            </button>
          ))}
          <Link
            href="/onboarding?mode=add"
            role="menuitem"
            onClick={() => setOpen(false)}
          >
            Dodaj profil
          </Link>
        </div>
      ) : null}
    </div>
  );
}
