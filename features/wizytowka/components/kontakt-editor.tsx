"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2, Pencil, X } from "lucide-react";
import { toast } from "gooey-toast";
import {
  updateGbpAddress,
  updateGbpPhones,
  updateGbpServiceArea,
  updateGbpWebsite,
} from "@/features/wizytowka/actions";
import {
  formatAddress,
  type GbpLocation,
} from "@/features/wizytowka/types";
import { UiSelect } from "@/features/shell/ui-select";

export function KontaktEditor({ location }: { location: GbpLocation }) {
  return (
    <div className="wiz-fields">
      <Editable
        label="Telefon"
        display={location.phoneNumbers?.primaryPhone ?? "-"}
        editor={({ close }) => (
          <PhoneForm
            initial={location.phoneNumbers?.primaryPhone ?? ""}
            additional={location.phoneNumbers?.additionalPhones ?? []}
            onDone={close}
          />
        )}
      />
      <Editable
        label="Witryna"
        display={location.websiteUri ?? "-"}
        editor={({ close }) => (
          <WebsiteForm initial={location.websiteUri ?? ""} onDone={close} />
        )}
      />
      <Editable
        label="Adres"
        display={formatAddress(location.storefrontAddress) || "-"}
        editor={({ close }) => (
          <AddressForm location={location} onDone={close} />
        )}
      />
      <Editable
        label="Obszar obsługi"
        display={
          location.serviceArea?.businessType
            ? `${location.serviceArea.businessType}${
                location.serviceArea.places?.placeInfos?.length
                  ? ` · ${location.serviceArea.places.placeInfos
                      .map((p) => p.placeName)
                      .filter(Boolean)
                      .join(", ")}`
                  : ""
              }`
            : "-"
        }
        editor={({ close }) => (
          <ServiceAreaForm location={location} onDone={close} />
        )}
      />
    </div>
  );
}

function Editable({
  label,
  display,
  editor,
}: {
  label: string;
  display: string;
  editor: (args: { close: () => void }) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="wiz-field-row">
      <div className="wiz-field-main">
        <div className="wiz-field-label">{label}</div>
        <div className="wiz-field-value">{display}</div>
      </div>
      <button
        type="button"
        className="ui-btn ui-btn-ghost ui-btn-sm"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? <X aria-hidden /> : <Pencil aria-hidden />}
      </button>
      {open ? <div className="wiz-field-editor">{editor({ close: () => setOpen(false) })}</div> : null}
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
      <input className="ui-field" value={value} onChange={(e) => setValue(e.target.value)} />
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

function WebsiteForm({
  initial,
  onDone,
}: {
  initial: string;
  onDone: () => void;
}) {
  const router = useRouter();
  const [value, setValue] = useState(initial);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="wiz-edit-form"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const result = await updateGbpWebsite({ websiteUri: value });
          if (!result.ok) {
            toast.error({ title: "Nie zapisano", description: result.error });
            return;
          }
          toast.success({ title: "Witryna zapisana w Google" });
          onDone();
          router.refresh();
        });
      }}
    >
      <input className="ui-field" value={value} onChange={(e) => setValue(e.target.value)} />
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
      <input className="ui-field" placeholder="Ulica i numer" value={line} onChange={(e) => setLine(e.target.value)} />
      <input className="ui-field" placeholder="Miasto" value={locality} onChange={(e) => setLocality(e.target.value)} />
      <input className="ui-field" placeholder="Kod pocztowy" value={postal} onChange={(e) => setPostal(e.target.value)} />
      <input className="ui-field" placeholder="Województwo" value={area} onChange={(e) => setArea(e.target.value)} />
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
  const [places, setPlaces] = useState(
    (location.serviceArea?.places?.placeInfos ?? [])
      .map((p) => p.placeName)
      .filter(Boolean)
      .join("\n"),
  );
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="wiz-edit-form"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const result = await updateGbpServiceArea({
            businessType: type as
              | "CUSTOMER_AND_BUSINESS_LOCATION"
              | "CUSTOMER_LOCATION_ONLY"
              | "BUSINESS_LOCATION_ONLY",
            placeNames: places
              .split("\n")
              .map((s) => s.trim())
              .filter(Boolean),
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
      <textarea
        className="ui-textarea"
        rows={3}
        placeholder="Miejsca / obszary (po jednej linii)"
        value={places}
        onChange={(e) => setPlaces(e.target.value)}
      />
      <Submit pending={pending} />
    </form>
  );
}

function Submit({ pending }: { pending: boolean }) {
  return (
    <button type="submit" className="ui-btn ui-btn-primary ui-btn-sm" disabled={pending}>
      {pending ? <Loader2 aria-hidden className="ui-btn-spinner" /> : null}
      Zapisz w Google
    </button>
  );
}
