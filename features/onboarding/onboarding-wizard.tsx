"use client";

import { useRouter } from "next/navigation";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft,
  ArrowRight,
  Award,
  BriefcaseBusiness,
  Check,
  Clock,
  Folder,
  FolderPlus,
  Link2,
  Loader2,
  MessageCircle,
  Search,
  Store,
  Users,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { toast } from "gooey-toast";
import {
  confirmGbpLocations,
  disconnectGbpAction,
  goToOnboardingStep,
  regenerateBriefAction,
  saveBriefAndContinue,
  skipGbpAndFinish,
  startGbpOAuth,
  submitOnboardingStep1,
} from "@/features/onboarding/actions";
import { AutoResizeTextarea } from "@/features/onboarding/auto-resize-textarea";
import { UiSelect } from "@/features/shell/ui-select";

type Location = {
  name: string;
  title: string;
  storefrontAddress?: string;
};

type DraftView = {
  id: string;
  step: string;
  profileId: string | null;
  websiteUrl: string | null;
  manualDescription: string | null;
  scrapeWarning: string | null;
  services: string;
  tone: string;
  targetAudience: string;
  differentiators: string;
  pendingLocations: Location[];
  hasConnection: boolean;
};

type GroupOption = { id: string; name: string };
type ProfileOption = { id: string; name: string };

type LinkMode = "none" | "new" | "existing" | "with_profile";

export function OnboardingWizard({
  mode,
  draft: initialDraft,
  groups,
  ungroupedProfiles = [],
  gbpStatus,
}: {
  mode: "new" | "add";
  draft: DraftView;
  groups: GroupOption[];
  /** Profile bez grupy - do „Połącz z istniejącym” przy mode=add. */
  ungroupedProfiles?: ProfileOption[];
  gbpStatus?: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const scrapeWarned = useRef(false);
  const gbpToasted = useRef(false);

  const step =
    initialDraft.step === "2" || initialDraft.step === "3"
      ? initialDraft.step
      : "1";

  // Step 1
  const [path, setPath] = useState<"website" | "manual">(
    initialDraft.manualDescription ? "manual" : "website",
  );
  const [websiteUrl, setWebsiteUrl] = useState(initialDraft.websiteUrl ?? "");
  const [description, setDescription] = useState(
    initialDraft.manualDescription ?? "",
  );

  // Step 2
  const [services, setServices] = useState(initialDraft.services);
  const [tone, setTone] = useState(initialDraft.tone);
  const [targetAudience, setTargetAudience] = useState(
    initialDraft.targetAudience,
  );
  const [differentiators, setDifferentiators] = useState(
    initialDraft.differentiators,
  );
  const [originalBrief] = useState({
    services: initialDraft.services,
    tone: initialDraft.tone,
    targetAudience: initialDraft.targetAudience,
    differentiators: initialDraft.differentiators,
  });

  // Step 3 locations
  const [selected, setSelected] = useState<string[]>(() =>
    initialDraft.pendingLocations.length === 1
      ? [initialDraft.pendingLocations[0].name]
      : [],
  );
  const [locationQuery, setLocationQuery] = useState("");
  const [groupMode, setGroupMode] = useState<LinkMode>("none");
  const [groupName, setGroupName] = useState("");
  const [existingGroupId, setExistingGroupId] = useState(groups[0]?.id ?? "");
  const [anchorProfileId, setAnchorProfileId] = useState(
    ungroupedProfiles[0]?.id ?? "",
  );
  const [regenOpen, setRegenOpen] = useState(false);
  const [regenNote, setRegenNote] = useState("");
  const [regenerating, setRegenerating] = useState(false);
  const autoConfirmed = useRef(false);

  // Wybrana opcja powiązania przestała być dostępna (np. odznaczono lokalizację) - wracamy do "osobno".
  // Korekta w renderze zamiast setState w efekcie.
  {
    const multi = selected.length > 1;
    const singleAdd = mode === "add" && selected.length === 1;
    const allowed =
      groupMode === "none" ||
      (groupMode === "new" && multi) ||
      (groupMode === "with_profile" &&
        singleAdd &&
        ungroupedProfiles.length > 0) ||
      (groupMode === "existing" && groups.length > 0);
    if (!allowed) setGroupMode("none");
  }

  const regenPortal = useSyncExternalStore(
    () => () => {},
    () => document.getElementById("split-right"),
    () => null,
  );

  const filteredLocations = useMemo(() => {
    const q = locationQuery.trim().toLowerCase();
    if (!q) return initialDraft.pendingLocations;
    return initialDraft.pendingLocations.filter((loc) => {
      const haystack =
        `${loc.title} ${loc.storefrontAddress ?? ""}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [initialDraft.pendingLocations, locationQuery]);

  useEffect(() => {
    if (scrapeWarned.current || !initialDraft.scrapeWarning) return;
    scrapeWarned.current = true;
    toast.warning({
      title: "Uwaga przy pobieraniu strony",
      description: initialDraft.scrapeWarning,
    });
  }, [initialDraft.scrapeWarning]);

  useEffect(() => {
    if (gbpToasted.current || !gbpStatus) return;
    gbpToasted.current = true;
    if (gbpStatus === "connected") {
      toast.success({
        title: "Połączono z Google",
        description: "Wybierz lokalizacje do podłączenia.",
      });
    } else if (gbpStatus === "denied") {
      toast.warning({
        title: "Odmówiono dostępu Google",
        description: "Możesz pominąć ten krok i wrócić później.",
      });
    } else if (gbpStatus === "error") {
      toast.error({
        title: "Nie udało się połączyć z Google",
        description: "Spróbuj ponownie albo pomiń ten krok.",
      });
    }
  }, [gbpStatus]);

  useEffect(() => {
    if (!regenOpen) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setRegenOpen(false);
        setRegenNote("");
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [regenOpen]);

  useEffect(() => {
    // Przy Dodaj profil + istniejące profile bez grupy użytkownik wybiera powiązanie.
    if (mode === "add" && (ungroupedProfiles.length > 0 || groups.length > 0)) {
      return;
    }
    if (
      autoConfirmed.current ||
      !initialDraft.hasConnection ||
      initialDraft.pendingLocations.length !== 1
    ) {
      return;
    }
    autoConfirmed.current = true;
    const only = initialDraft.pendingLocations[0].name;
    setSelected([only]);
    startTransition(async () => {
      const result = await confirmGbpLocations({
        mode,
        locationNames: [only],
        groupMode: "none",
      });
      if (result && !result.ok) {
        toast.error({
          title: "Nie udało się",
          description: result.error,
        });
        autoConfirmed.current = false;
      }
    });
  }, [
    initialDraft.hasConnection,
    initialDraft.pendingLocations,
    mode,
    ungroupedProfiles.length,
    groups.length,
  ]);

  const briefEdited = useMemo(() => {
    return (
      services !== originalBrief.services ||
      tone !== originalBrief.tone ||
      targetAudience !== originalBrief.targetAudience ||
      differentiators !== originalBrief.differentiators
    );
  }, [services, tone, targetAudience, differentiators, originalBrief]);

  function refresh() {
    router.refresh();
  }

  function closeRegenModal() {
    setRegenOpen(false);
    setRegenNote("");
  }

  function submitRegen() {
    if (
      briefEdited &&
      !window.confirm(
        "Regeneracja nadpisze Twoje poprawki w polach briefu. Kontynuować?",
      )
    ) {
      return;
    }
    setRegenOpen(false);
    setRegenerating(true);
    startTransition(async () => {
      const result = await regenerateBriefAction({
        mode,
        note: regenNote,
        currentServices: services,
        currentTone: tone,
        currentTargetAudience: targetAudience,
        currentDifferentiators: differentiators,
      });
      setRegenNote("");
      if (!result.ok) {
        setRegenerating(false);
        toast.error({
          title: "Regeneracja nie powiodła się",
          description: result.error,
        });
        return;
      }
      toast.success({
        title: "Brief wygenerowany ponownie",
        description: "Sprawdź i popraw pola przed kolejnym krokiem.",
      });
      refresh();
    });
  }

  if (step === "1") {
    return (
      <>
        <p className="split-step">Krok 1/3</p>
        <h1>Masz stronę internetową?</h1>
        <p className="split-right-lead">
          Wklej adres, a pobierzemy dane i przygotujemy brief. Nie masz strony?
          Opisz firmę w kilku zdaniach.
        </p>

        <div className="path-toggle" role="tablist" aria-label="Ścieżka startu">
          <button
            type="button"
            data-active={path === "website"}
            disabled={pending}
            onClick={() => setPath("website")}
          >
            Mam stronę WWW
          </button>
          <button
            type="button"
            data-active={path === "manual"}
            disabled={pending}
            onClick={() => setPath("manual")}
          >
            Nie mam strony
          </button>
        </div>

        {path === "website" ? (
          <div className="auth-field">
            <label htmlFor="website">Adres strony WWW</label>
            <input
              id="website"
              className="ui-field"
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
              placeholder="architekcibiznesu.pl"
              disabled={pending}
            />
            <p className="auth-hint">
              <Clock aria-hidden width={14} height={14} />
              Zajmie to kilka sekund - brief zobaczysz w następnym kroku.
            </p>
          </div>
        ) : (
          <div className="auth-field">
            <label htmlFor="description">Krótki opis firmy</label>
            <textarea
              id="description"
              className="ui-textarea"
              rows={5}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Czym się zajmujecie, dla kogo i w jakim mieście działacie?"
              disabled={pending}
            />
          </div>
        )}

        <div className="onboarding-actions onboarding-actions-solo">
          <button
            type="button"
            className="ui-btn ui-btn-primary"
            disabled={pending}
            aria-busy={pending}
            onClick={() => {
              startTransition(async () => {
                const result = await submitOnboardingStep1(
                  path === "website"
                    ? { path: "website", websiteUrl, mode }
                    : { path: "manual", description, mode },
                );
                if (!result.ok) {
                  toast.error({
                    title: "Nie udało się",
                    description: result.error,
                  });
                  return;
                }
                toast.success({
                  title: "Brief gotowy",
                  description: "Sprawdź i popraw pola w następnym kroku.",
                });
                refresh();
              });
            }}
          >
            {pending ? (
              <>
                <Loader2 aria-hidden className="ui-btn-spinner" />
                Przygotowuję…
              </>
            ) : (
              <>
                Dalej <ArrowRight aria-hidden />
              </>
            )}
          </button>
        </div>
      </>
    );
  }

  if (step === "2") {
    return (
      <>
        <p className="split-step">Krok 2/3</p>
        <h1>Sprawdź brief od AI</h1>
        <p className="split-right-lead">
          To propozycja startowa - możesz poprawić każde pole przed kolejnym
          krokiem.
        </p>

        <div
          className={`brief-fields${regenerating ? " is-regenerating" : ""}`}
          aria-busy={regenerating}
        >
          {regenerating ? (
            <div className="brief-regen-status" role="status">
              <span>Generuję nowy brief</span>
              <span className="brief-regen-dots" aria-hidden>
                <i />
                <i />
                <i />
              </span>
            </div>
          ) : null}

          {(
            [
              {
                id: "services",
                label: "Usługi",
                icon: BriefcaseBusiness,
                value: services,
                onChange: setServices,
                lines: ["92%", "64%"],
              },
              {
                id: "tone",
                label: "Ton komunikacji",
                icon: MessageCircle,
                value: tone,
                onChange: setTone,
                lines: ["96%", "88%", "52%"],
              },
              {
                id: "audience",
                label: "Grupa docelowa",
                icon: Users,
                value: targetAudience,
                onChange: setTargetAudience,
                lines: ["94%", "76%", "40%"],
              },
              {
                id: "differentiators",
                label: "Czym się wyróżniacie",
                icon: Award,
                value: differentiators,
                onChange: setDifferentiators,
                lines: ["90%", "70%", "48%"],
              },
            ] as const satisfies ReadonlyArray<{
              id: string;
              label: string;
              icon: LucideIcon;
              value: string;
              onChange: (value: string) => void;
              lines: readonly string[];
            }>
          ).map((field, fieldIndex) => {
            const Icon = field.icon;
            return (
              <div
                className="auth-field"
                key={field.id}
                style={{ ["--brief-i" as string]: fieldIndex }}
              >
                <label htmlFor={field.id}>
                  <Icon aria-hidden className="brief-field-icon" />
                  {field.label}
                </label>
                <div className="brief-field-shell">
                  <AutoResizeTextarea
                    id={field.id}
                    value={field.value}
                    onChange={field.onChange}
                    disabled={regenerating}
                  />
                  {regenerating ? (
                    <div className="brief-skel" aria-hidden>
                      {field.lines.map((width, lineIndex) => (
                        <span
                          key={lineIndex}
                          className="brief-skel-line"
                          style={{
                            width,
                            ["--line-i" as string]: lineIndex,
                          }}
                        />
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>

        <div className="onboarding-actions">
          <button
            type="button"
            className="ui-btn ui-btn-outline"
            disabled={pending || regenerating}
            onClick={() => {
              startTransition(async () => {
                await goToOnboardingStep(mode, "1");
                refresh();
              });
            }}
          >
            <ArrowLeft aria-hidden /> Wstecz
          </button>

          <button
            type="button"
            className="ui-btn ui-btn-outline regen-trigger"
            disabled={pending || regenerating}
            aria-haspopup="dialog"
            aria-expanded={regenOpen}
            onClick={() => setRegenOpen(true)}
          >
            {regenerating ? (
              <Loader2 aria-hidden className="ui-btn-spinner" />
            ) : (
              <Sparkles aria-hidden />
            )}
            {regenerating ? "Generuję…" : "Wygeneruj ponownie"}
          </button>

          <button
            type="button"
            className="ui-btn ui-btn-primary onboarding-actions-next"
            disabled={pending || regenerating}
            aria-busy={pending}
            onClick={() => {
              startTransition(async () => {
                const result = await saveBriefAndContinue({
                  mode,
                  services,
                  tone,
                  targetAudience,
                  differentiators,
                });
                if (!result.ok) {
                  toast.error({
                    title: "Nie udało się zapisać",
                    description: result.error,
                  });
                  return;
                }
                toast.success({
                  title: "Brief zapisany",
                  description: "Połącz wizytówkę Google albo pomiń ten krok.",
                });
                refresh();
              });
            }}
          >
            {pending && !regenerating ? (
              <>
                <Loader2 aria-hidden className="ui-btn-spinner" />
                Zapisuję…
              </>
            ) : (
              <>
                Dalej <ArrowRight aria-hidden />
              </>
            )}
          </button>
        </div>

        {regenOpen && regenPortal
          ? createPortal(
              <div
                className="regen-modal-overlay"
                role="presentation"
                onMouseDown={(event) => {
                  if (event.target === event.currentTarget) {
                    closeRegenModal();
                  }
                }}
              >
                <div
                  className="regen-modal"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="regen-modal-title"
                >
                  <h2 id="regen-modal-title">Co zmienić lub dodać?</h2>
                  <p className="regen-modal-hint">
                    Opcjonalnie - zostaw puste, żeby wygenerować nową wersję z
                    aktualnego briefu.
                  </p>
                  <textarea
                    id="regen-note"
                    className="ui-textarea"
                    rows={8}
                    autoFocus
                    value={regenNote}
                    onChange={(e) => setRegenNote(e.target.value)}
                    placeholder="np. dodaj konsultacje, bardziej lokalny ton, krótsze usługi"
                  />
                  <div className="regen-modal-actions">
                    <button
                      type="button"
                      className="ui-btn ui-btn-outline"
                      disabled={pending}
                      onClick={closeRegenModal}
                    >
                      Anuluj
                    </button>
                    <button
                      type="button"
                      className="ui-btn ui-btn-primary"
                      disabled={pending}
                      onClick={submitRegen}
                    >
                      <Sparkles aria-hidden />
                      Wygeneruj ponownie
                    </button>
                  </div>
                </div>
              </div>,
              regenPortal,
            )
          : null}
      </>
    );
  }

  // Step 3
  const showLocationPicker =
    initialDraft.hasConnection && initialDraft.pendingLocations.length > 0;

  return (
    <>
      <p className="split-step">Krok 3/3</p>
      <h1>Połącz wizytówkę Google</h1>
      <p className="split-right-lead">
        To najszybszy sposób na start - pobierzemy lokalizacje i dane firmy.
      </p>

      {!showLocationPicker ? (
        <div className="gbp-connect-block">
          <button
            type="button"
            className="google-connect-btn"
            disabled={pending}
            onClick={() => {
              startTransition(async () => {
                await startGbpOAuth(mode);
              });
            }}
          >
            <GoogleGlyph />
            Połącz wizytówkę Google
          </button>

          <div className="onboarding-actions onboarding-actions-pair">
            <button
              type="button"
              className="ui-btn ui-btn-outline"
              disabled={pending}
              onClick={() => {
                startTransition(async () => {
                  await goToOnboardingStep(mode, "2");
                  refresh();
                });
              }}
            >
              <ArrowLeft aria-hidden /> Wstecz
            </button>
            <button
              type="button"
              className="ui-btn ui-btn-ghost"
              disabled={pending}
              onClick={() => {
                startTransition(async () => {
                  toast.success({
                    title: "Onboarding zakończony",
                    description:
                      "Możesz wrócić do Google później w ustawieniach.",
                  });
                  await skipGbpAndFinish(mode);
                });
              }}
            >
              Pomiń
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="location-picker">
            <label className="location-picker-search">
              <Search aria-hidden />
              <input
                type="search"
                value={locationQuery}
                onChange={(e) => setLocationQuery(e.target.value)}
                placeholder="Szukaj po nazwie lub adresie"
                aria-label="Szukaj profilu"
              />
            </label>

            <p className="location-picker-head">
              <span>Lokalizacje w Google</span>
              <span className="mono">
                {selected.length > 0
                  ? `${selected.length}/${initialDraft.pendingLocations.length}`
                  : initialDraft.pendingLocations.length}
              </span>
            </p>

            <div className="location-list">
              {filteredLocations.length === 0 ? (
                <p className="location-empty">
                  Brak wyników dla podanego hasła.
                </p>
              ) : (
                filteredLocations.map((loc, index) => {
                  const inputId = `loc-${index}-${loc.name.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
                  const checked = selected.includes(loc.name);
                  return (
                    <label
                      key={loc.name}
                      htmlFor={inputId}
                      className={`location-item${checked ? " is-selected" : ""}`}
                    >
                      <input
                        id={inputId}
                        type="checkbox"
                        className="location-item-input"
                        checked={checked}
                        onChange={() => {
                          setSelected((prev) =>
                            checked
                              ? prev.filter((n) => n !== loc.name)
                              : [...prev, loc.name],
                          );
                        }}
                      />
                      <span className="location-item-avatar" aria-hidden>
                        {loc.title.trim().slice(0, 2).toUpperCase()}
                      </span>
                      <span className="location-item-body">
                        <strong>{loc.title}</strong>
                        {loc.storefrontAddress ? (
                          <span className="location-item-meta">
                            {loc.storefrontAddress}
                          </span>
                        ) : null}
                      </span>
                      <span className="location-item-check" aria-hidden>
                        <Check />
                      </span>
                    </label>
                  );
                })
              )}
            </div>
          </div>

          {(() => {
            const canLinkSingle =
              mode === "add" &&
              (ungroupedProfiles.length > 0 || groups.length > 0);
            const showLink =
              selected.length > 1 || canLinkSingle;
            if (!showLink) return null;

            const linkDisabled = selected.length === 0;
            const multi = selected.length > 1;

            return (
              <fieldset
                className={`location-link${linkDisabled ? " is-disabled" : ""}`}
                disabled={linkDisabled}
                aria-disabled={linkDisabled}
              >
                <legend className="location-link-title">
                  {multi
                    ? "Jak połączyć te lokalizacje?"
                    : "Jak powiązać ten profil?"}
                </legend>
                <p className="location-link-lead">
                  {linkDisabled
                    ? "Najpierw zaznacz lokalizację powyżej - wtedy wybierzesz, czy zostaje osobno, czy w grupie."
                    : multi
                      ? "Możesz trzymać je osobno albo wrzucić do jednej grupy - wtedy te same treści publikujesz na wszystkich naraz."
                      : "Domyślnie zostaje osobno. Grupa ułatwia publikację tych samych treści na kilku profilach naraz."}
                </p>

                <div
                  className="location-link-list"
                  role="radiogroup"
                  aria-label="Sposób powiązania"
                  aria-disabled={linkDisabled}
                >
                  <LinkOption
                    active={groupMode === "none"}
                    onSelect={() => setGroupMode("none")}
                    disabled={linkDisabled}
                    icon={Store}
                    title={
                      multi
                        ? "Osobno - każde miejsce to osobny profil"
                        : "Osobno - bez grupy publikacji"
                    }
                    desc="Najprostszy wybór, jeśli nie publikujesz wspólnie."
                  />

                  {multi ? (
                    <LinkOption
                      active={groupMode === "new"}
                      onSelect={() => setGroupMode("new")}
                      disabled={linkDisabled}
                      icon={FolderPlus}
                      title="Razem - utwórz nową grupę publikacji"
                      desc="Wszystkie zaznaczone lokalizacje w jednej grupie."
                    >
                      <div className="auth-field">
                        <label htmlFor="groupNameNew">
                          Nazwa grupy publikacji
                        </label>
                        <input
                          id="groupNameNew"
                          className="ui-field"
                          placeholder="np. Salony Warszawa"
                          value={groupName}
                          onChange={(e) => setGroupName(e.target.value)}
                        />
                      </div>
                    </LinkOption>
                  ) : null}

                  {!multi &&
                  mode === "add" &&
                  ungroupedProfiles.length > 0 ? (
                    <LinkOption
                      active={groupMode === "with_profile"}
                      onSelect={() => setGroupMode("with_profile")}
                      disabled={linkDisabled}
                      icon={Link2}
                      title="Połącz z istniejącym profilem"
                      desc="Utwórz grupę z firmą, którą już masz w panelu."
                    >
                      <div className="auth-field">
                        <label htmlFor="anchorProfile">
                          Z którym profilem w panelu?
                        </label>
                        <UiSelect
                          id="anchorProfile"
                          value={anchorProfileId}
                          onChange={setAnchorProfileId}
                          disabled={linkDisabled}
                          options={ungroupedProfiles.map((p) => ({
                            value: p.id,
                            label: p.name,
                          }))}
                        />
                      </div>
                      <div className="auth-field">
                        <label htmlFor="groupNameWithProfile">
                          Nazwa grupy publikacji
                        </label>
                        <input
                          id="groupNameWithProfile"
                          className="ui-field"
                          placeholder="np. Salony Warszawa"
                          value={groupName}
                          onChange={(e) => setGroupName(e.target.value)}
                          disabled={linkDisabled}
                        />
                      </div>
                    </LinkOption>
                  ) : null}

                  {groups.length > 0 ? (
                    <LinkOption
                      active={groupMode === "existing"}
                      onSelect={() => setGroupMode("existing")}
                      disabled={linkDisabled}
                      icon={Folder}
                      title={
                        multi
                          ? "Razem - dodaj do istniejącej grupy"
                          : "Dodaj do istniejącej grupy"
                      }
                      desc="Dołącz do grupy, którą już masz w panelu."
                    >
                      <div className="auth-field">
                        <label htmlFor="existingGroup">Która grupa?</label>
                        <UiSelect
                          id="existingGroup"
                          value={existingGroupId}
                          onChange={setExistingGroupId}
                          disabled={linkDisabled}
                          options={groups.map((g) => ({
                            value: g.id,
                            label: g.name,
                          }))}
                        />
                      </div>
                    </LinkOption>
                  ) : null}
                </div>
              </fieldset>
            );
          })()}

          <div className="onboarding-actions location-actions">
            <button
              type="button"
              className="ui-btn ui-btn-outline"
              disabled={pending}
              onClick={() => {
                startTransition(async () => {
                  const result = await disconnectGbpAction(mode);
                  if (!result.ok) {
                    toast.error({
                      title: "Nie udało się",
                      description: result.error,
                    });
                    return;
                  }
                  toast.success({
                    title: "Rozłączono Google",
                    description: "Możesz połączyć wizytówkę ponownie.",
                  });
                  setSelected([]);
                  refresh();
                });
              }}
            >
              <ArrowLeft aria-hidden /> Wstecz
            </button>
            <button
              type="button"
              className="ui-btn ui-btn-primary onboarding-actions-next"
              disabled={pending || selected.length === 0}
              onClick={() => {
                startTransition(async () => {
                  const result = await confirmGbpLocations({
                    mode,
                    locationNames: selected,
                    groupMode,
                    groupName,
                    existingGroupId: existingGroupId || undefined,
                    anchorProfileId:
                      groupMode === "with_profile"
                        ? anchorProfileId || undefined
                        : undefined,
                  });
                  if (result && !result.ok) {
                    toast.error({
                      title: "Nie udało się podłączyć",
                      description: result.error,
                    });
                  }
                });
              }}
            >
              {pending ? (
                <>
                  <Loader2 aria-hidden className="ui-btn-spinner" />
                  Podłączam…
                </>
              ) : (
                <>
                  {selected.length > 1
                    ? `Podłącz profile (${selected.length})`
                    : "Podłącz profil"}
                  <ArrowRight aria-hidden />
                </>
              )}
            </button>
          </div>
        </>
      )}
    </>
  );
}

/** Opcja powiązania: kafel-radio, a pod nim (gdy wybrana) dodatkowe pola. */
function LinkOption({
  active,
  onSelect,
  disabled = false,
  icon: Icon,
  title,
  desc,
  children,
}: {
  active: boolean;
  onSelect: () => void;
  disabled?: boolean;
  icon: LucideIcon;
  title: string;
  desc: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={`location-link-option${active ? " is-active" : ""}${disabled ? " is-disabled" : ""}`}
    >
      <button
        type="button"
        role="radio"
        aria-checked={active}
        aria-disabled={disabled}
        className="location-link-item"
        disabled={disabled}
        onClick={() => {
          if (!disabled) onSelect();
        }}
      >
        <span className="location-link-icon" aria-hidden>
          <Icon />
        </span>
        <span className="location-link-item-copy">
          <strong>{title}</strong>
          <span>{desc}</span>
        </span>
        <span className="location-link-radio" aria-hidden />
      </button>
      {active && children && !disabled ? (
        <div className="location-link-extra">{children}</div>
      ) : null}
    </div>
  );
}

function GoogleGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.2 6.1 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.5-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.2 6.1 29.4 4 24 4 16.1 4 9.2 8.5 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.3 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.1 39.4 16 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-1.1 3.2-3.5 5.7-6.5 7.1l6.2 5.2C38.9 36.9 44 31.2 44 24c0-1.3-.1-2.5-.4-3.5z"
      />
    </svg>
  );
}
