"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Search, X } from "lucide-react";
import { toast } from "gooey-toast";
import {
  searchServiceAreaPlaces,
  updateGbpAddress,
  updateGbpPhones,
  updateGbpServiceArea,
} from "@/features/wizytowka/actions";
import {
  formatAddress,
  type GbpLocation,
} from "@/features/wizytowka/types";
import { UiSelect } from "@/features/shell/ui-select";

const BUSINESS_TYPE_LABELS: Record<string, string> = {
  CUSTOMER_AND_BUSINESS_LOCATION: "Lokal + dojazd do klienta",
  CUSTOMER_LOCATION_ONLY: "Tylko dojazd do klienta",
  BUSINESS_LOCATION_ONLY: "Tylko lokal stacjonarny",
};

type PlaceItem = { placeId: string; placeName: string };

const PREVIEW_CHIP_LIMIT = 8;

function shortPlaceLabel(name: string) {
  return name.replace(/,\s*Polska\s*$/i, "").trim() || name;
}

function ServiceAreaPreview({ location }: { location: GbpLocation }) {
  const type = location.serviceArea?.businessType;
  if (!type) return <>-</>;
  const typeLabel = BUSINESS_TYPE_LABELS[type] ?? type;
  const names = (location.serviceArea?.places?.placeInfos ?? [])
    .map((p) => p.placeName)
    .filter((n): n is string => Boolean(n?.trim()));

  const shown = names.slice(0, PREVIEW_CHIP_LIMIT);
  const rest = names.length - shown.length;

  return (
    <ul className="wiz-cat-chips">
      <li>
        <span className="ui-pill wiz-cat-chip-primary">{typeLabel}</span>
      </li>
      {shown.length > 0 ? (
        <li className="wiz-cat-chips-sep" aria-hidden />
      ) : null}
      {shown.map((name) => (
        <li key={name}>
          <span className="ui-pill wiz-cat-chip-extra">
            {shortPlaceLabel(name)}
          </span>
        </li>
      ))}
      {rest > 0 ? (
        <li>
          <span className="ui-pill wiz-cat-chip-extra">+{rest}</span>
        </li>
      ) : null}
    </ul>
  );
}

/** Phone, address, service area - shown on Informacje tab. */
export function LocationNapFields({ location }: { location: GbpLocation }) {
  const additional = location.phoneNumbers?.additionalPhones ?? [];
  const primaryPhone = location.phoneNumbers?.primaryPhone?.trim() || "";

  return (
    <>
      <NapField
        label="Telefon"
        anchorId="wiz-field-phone"
        display={
          primaryPhone ? (
            <span className="wiz-phone-display">
              <span className="mono">{primaryPhone}</span>
              {additional.length > 0 ? (
                <span className="ui-pill ui-pill-neutral">
                  +{additional.length}{" "}
                  {additional.length === 1 ? "dodatkowy" : "dodatkowe"}
                </span>
              ) : null}
            </span>
          ) : (
            <span className="mono">-</span>
          )
        }
        editor={({ close }) => (
          <PhoneForm
            initial={location.phoneNumbers?.primaryPhone ?? ""}
            additional={additional}
            onDone={close}
          />
        )}
      />
      <NapField
        label="Adres"
        anchorId="wiz-field-address"
        display={
          <span className="mono">
            {formatAddress(location.storefrontAddress) || "-"}
          </span>
        }
        editor={({ close }) => (
          <AddressForm location={location} onDone={close} />
        )}
      />
      <NapField
        label="Obszar obsługi"
        anchorId="wiz-field-service-area"
        display={<ServiceAreaPreview location={location} />}
        editor={({ close }) => (
          <ServiceAreaForm location={location} onDone={close} />
        )}
      />
    </>
  );
}

function NapField({
  label,
  anchorId,
  display,
  editor,
}: {
  label: string;
  anchorId: string;
  display: React.ReactNode;
  editor: (args: { close: () => void }) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div id={anchorId} className="wiz-field-row">
      <div className="wiz-field-label">{label}</div>
      <div className="wiz-field-content">
        {open ? (
          <div className="wiz-edit-block">
            {editor({ close: () => setOpen(false) })}
          </div>
        ) : (
          display
        )}
      </div>
      <button
        type="button"
        className={`wiz-field-edit${open ? " is-open" : ""}`}
        aria-label={open ? `Zamknij: ${label}` : `Edytuj: ${label}`}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? <X aria-hidden /> : <Pencil aria-hidden />}
      </button>
    </div>
  );
}

function PhoneForm({
  initial,
  additional,
  onDone,
}: {
  initial: string;
  additional: string[];
  onDone: () => void;
}) {
  const router = useRouter();
  const [value, setValue] = useState(initial);
  const [extra, setExtra] = useState(additional.join(", "));
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="wiz-edit-form"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (!value.trim()) {
          toast.error({ title: "Podaj numer telefonu" });
          return;
        }
        startTransition(async () => {
          const result = await updateGbpPhones({
            primaryPhone: value,
            additionalPhones: extra
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean),
          });
          if (!result.ok) {
            toast.error({ title: "Nie zapisano", description: result.error });
            return;
          }
          toast.success({ title: "Telefon zapisany w Google" });
          onDone();
          router.refresh();
        });
      }}
    >
      <input
        className="ui-field"
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <input
        className="ui-field"
        placeholder="Dodatkowe numery (po przecinku)"
        value={extra}
        onChange={(e) => setExtra(e.target.value)}
      />
      <Submit pending={pending} />
    </form>
  );
}

function AddressForm({
  location,
  onDone,
}: {
  location: GbpLocation;
  onDone: () => void;
}) {
  const router = useRouter();
  const addr = location.storefrontAddress;
  const [line, setLine] = useState(addr?.addressLines?.[0] ?? "");
  const [locality, setLocality] = useState(addr?.locality ?? "");
  const [postal, setPostal] = useState(addr?.postalCode ?? "");
  const [area, setArea] = useState(addr?.administrativeArea ?? "");
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="wiz-edit-form"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (!line.trim()) {
          toast.error({ title: "Podaj ulicę i numer" });
          return;
        }
        startTransition(async () => {
          const result = await updateGbpAddress({
            regionCode: addr?.regionCode ?? "PL",
            addressLines: [line],
            locality,
            postalCode: postal,
            administrativeArea: area,
          });
          if (!result.ok) {
            toast.error({ title: "Nie zapisano", description: result.error });
            return;
          }
          toast.success({ title: "Adres zapisany w Google" });
          onDone();
          router.refresh();
        });
      }}
    >
      <label className="wiz-edit-field">
        <span className="wiz-edit-field-label">Ulica i numer</span>
        <input
          className="ui-field"
          value={line}
          onChange={(e) => setLine(e.target.value)}
        />
      </label>
      <div className="wiz-edit-fields-row">
        <label className="wiz-edit-field">
          <span className="wiz-edit-field-label">Miasto</span>
          <input
            className="ui-field"
            value={locality}
            onChange={(e) => setLocality(e.target.value)}
          />
        </label>
        <label className="wiz-edit-field">
          <span className="wiz-edit-field-label">Kod pocztowy</span>
          <input
            className="ui-field mono"
            value={postal}
            onChange={(e) => setPostal(e.target.value)}
          />
        </label>
        <label className="wiz-edit-field">
          <span className="wiz-edit-field-label">Województwo</span>
          <input
            className="ui-field"
            value={area}
            onChange={(e) => setArea(e.target.value)}
          />
        </label>
      </div>
      <p className="wiz-edit-note">
        Adres musi przejść weryfikację Google - zmiany mogą być widoczne z
        opóźnieniem.
      </p>
      <Submit pending={pending} />
    </form>
  );
}

function ServiceAreaForm({
  location,
  onDone,
}: {
  location: GbpLocation;
  onDone: () => void;
}) {
  const router = useRouter();
  const [type, setType] = useState(
    location.serviceArea?.businessType ?? "CUSTOMER_AND_BUSINESS_LOCATION",
  );
  const [places, setPlaces] = useState<PlaceItem[]>(() =>
    (location.serviceArea?.places?.placeInfos ?? [])
      .filter((p) => p.placeName?.trim())
      .map((p) => ({
        placeId: p.placeId?.trim() || `name:${p.placeName}`,
        placeName: p.placeName!.trim(),
      })),
  );
  const [pending, startTransition] = useTransition();
  const showPlaces = type !== "BUSINESS_LOCATION_ONLY";

  return (
    <form
      className="wiz-edit-form wiz-service-area-form"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const toSave = showPlaces
          ? places.filter((p) => p.placeId && !p.placeId.startsWith("name:"))
          : [];
        if (showPlaces && places.some((p) => p.placeId.startsWith("name:"))) {
          toast.warning({
            title: "Część miejsc bez ID z Google",
            description:
              "Usuń stare wpisy i dodaj je ponownie przez wyszukiwarkę.",
          });
        }
        if (showPlaces && places.length > 0 && toSave.length === 0) {
          toast.error({
            title: "Dodaj obszary z wyszukiwarki",
            description: "Google wymaga placeId - wybierz miejsca z listy.",
          });
          return;
        }
        startTransition(async () => {
          const result = await updateGbpServiceArea({
            businessType: type as
              | "CUSTOMER_AND_BUSINESS_LOCATION"
              | "CUSTOMER_LOCATION_ONLY"
              | "BUSINESS_LOCATION_ONLY",
            places: toSave,
          });
          if (!result.ok) {
            toast.error({ title: "Nie zapisano", description: result.error });
            return;
          }
          toast.success({ title: "Obszar zapisany w Google" });
          onDone();
          router.refresh();
        });
      }}
    >
      <div className="wiz-service-area-field">
        <label className="wiz-service-area-label">Typ obsługi</label>
        <UiSelect
          aria-label="Typ obszaru"
          value={type}
          onChange={setType}
          options={[
            {
              value: "CUSTOMER_AND_BUSINESS_LOCATION",
              label: "Lokal + dojazd do klienta",
            },
            {
              value: "CUSTOMER_LOCATION_ONLY",
              label: "Tylko dojazd do klienta",
            },
            {
              value: "BUSINESS_LOCATION_ONLY",
              label: "Tylko lokal stacjonarny",
            },
          ]}
        />
      </div>

      {showPlaces ? (
        <div className="wiz-service-area-field">
          <label className="wiz-service-area-label">
            Obszary dojazdu
            <span className="wiz-service-area-count mono">
              {places.length}/20
            </span>
          </label>
          {places.length > 0 ? (
            <ul className="wiz-cat-chips">
              {places.map((place) => (
                <li key={place.placeId} className="wiz-service-area-chip-wrap">
                  <span className="ui-pill wiz-cat-chip-extra">
                    {shortPlaceLabel(place.placeName)}
                    <button
                      type="button"
                      className="wiz-service-area-chip-remove"
                      aria-label={`Usuń ${place.placeName}`}
                      onClick={() =>
                        setPlaces((prev) =>
                          prev.filter((p) => p.placeId !== place.placeId),
                        )
                      }
                    >
                      <X aria-hidden />
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="wiz-service-area-hint">
              Dodaj miasta lub regiony przez wyszukiwarkę.
            </p>
          )}
          <ServiceAreaPlacePicker
            selectedIds={new Set(places.map((p) => p.placeId))}
            onAdd={(place) => {
              if (places.length >= 20) {
                toast.error({ title: "Limit 20 obszarów" });
                return;
              }
              if (places.some((p) => p.placeId === place.placeId)) return;
              setPlaces((prev) => [...prev, place]);
            }}
          />
        </div>
      ) : null}

      <Submit pending={pending} />
    </form>
  );
}

function ServiceAreaPlacePicker({
  selectedIds,
  onAdd,
}: {
  selectedIds: Set<string>;
  onAdd: (place: PlaceItem) => void;
}) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<PlaceItem[]>([]);
  const [searching, startSearch] = useTransition();

  useEffect(() => {
    if (!open) return;
    function onDoc(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    const handle = window.setTimeout(() => {
      startSearch(async () => {
        const result = await searchServiceAreaPlaces({ query: q });
        if (!result.ok) {
          toast.error({
            title: "Wyszukiwanie niedostępne",
            description: result.error,
          });
          setResults([]);
          return;
        }
        setResults(result.results);
        setOpen(true);
      });
    }, 280);
    return () => window.clearTimeout(handle);
  }, [query]);

  const visible = results.filter((r) => !selectedIds.has(r.placeId));

  return (
    <div className="wiz-service-area-picker" ref={rootRef}>
      <div className="ui-search">
        <Search aria-hidden className="ui-search-icon" />
        <input
          type="search"
          className="ui-field ui-search-input"
          placeholder="Szukaj miasta lub regionu…"
          value={query}
          autoComplete="off"
          aria-autocomplete="list"
          aria-controls={listId}
          aria-expanded={open && visible.length > 0}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
        />
        {searching ? (
          <Loader2 aria-hidden className="wiz-service-area-spinner ui-btn-spinner" />
        ) : null}
      </div>
      {open && query.trim().length >= 2 ? (
        <ul id={listId} className="wiz-service-area-menu" role="listbox">
          {visible.length === 0 && !searching ? (
            <li className="wiz-service-area-empty">Brak wyników</li>
          ) : (
            visible.map((place) => (
              <li key={place.placeId}>
                <button
                  type="button"
                  className="wiz-service-area-option"
                  role="option"
                  onClick={() => {
                    onAdd(place);
                    setQuery("");
                    setResults([]);
                    setOpen(false);
                  }}
                >
                  {place.placeName}
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}

function Submit({ pending }: { pending: boolean }) {
  return (
    <button
      type="submit"
      className="ui-btn ui-btn-primary ui-btn-sm"
      disabled={pending}
    >
      {pending ? <Loader2 aria-hidden className="ui-btn-spinner" /> : null}
      Zapisz w Google
    </button>
  );
}
