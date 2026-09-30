import { ModuleHeader } from "@/features/shell/module-header";
import { Skel, SkelSubnav, SkelText } from "@/features/shell/skeleton";
import {
  KONTEKST_FIELDS,
  KONTEKST_INTRO,
} from "@/features/ustawienia/kontekst-fields";
import {
  USTAWIENIA_HEADER,
  USTAWIENIA_TABS,
} from "@/features/ustawienia/module";

/** Ustawienia on first entry - the company context form (the first tab). */
export function UstawieniaSkeleton() {
  return (
    <div className="wiz-page" aria-busy="true" aria-label="Ładowanie ustawień">
      <ModuleHeader {...USTAWIENIA_HEADER} className="wiz-header" />
      <SkelSubnav tabs={USTAWIENIA_TABS} />
      <div className="ui-section">
        <h2 className="text-lg font-semibold">Kontekst firmy</h2>
        <p className="mt-1 mb-4 text-sm text-muted-foreground">
          {KONTEKST_INTRO}
        </p>
        <div className="kontekst-form">
          {KONTEKST_FIELDS.slice(0, 4).map(([name, label]) => (
            <div key={name} className="kontekst-field">
              <span className="text-sm font-medium">{label}</span>
              <p className="locked-note mt-1">
                <SkelText w="60%" />
              </p>
              {/* Textarea heights of the loaded form: 4 rows / 3 rows. */}
              <Skel
                w="100%"
                h={name === "services" ? 92 : 75}
                block
                style={{ marginTop: 8 }}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
