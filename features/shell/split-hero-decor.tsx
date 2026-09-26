import {
  Check,
  Globe,
  LayoutGrid,
  MapPin,
  MessageSquare,
  Sparkles,
  Star,
} from "lucide-react";

export type SplitDecorVariant =
  | "login"
  | "register"
  | "onboarding-1"
  | "onboarding-2"
  | "onboarding-3";

function CompletenessBars() {
  return (
    <div className="split-decor-bars" aria-hidden>
      {Array.from({ length: 10 }, (_, i) => (
        <span
          key={i}
          className={`split-decor-bar${i < 7 ? " is-on" : ""}`}
        />
      ))}
    </div>
  );
}

function SkeletonLine({ wide }: { wide?: "full" | "mid" | "short" }) {
  return (
    <span
      className={`split-decor-skel${wide === "mid" ? " is-mid" : wide === "short" ? " is-short" : ""}`}
    />
  );
}

function LoginDecor() {
  return (
    <div className="split-decor split-decor-login" aria-hidden>
      <div className="split-decor-login-cols">
        <div className="split-decor-col">
          <div className="split-decor-card">
            <div className="split-decor-card-head">
              <span className="split-decor-icon">
                <MapPin aria-hidden />
              </span>
              <div>
                <p className="split-decor-card-title">Wizytówka Google</p>
                <p className="split-decor-card-sub">Kompletność profilu</p>
              </div>
              <span className="split-decor-score mono">7/10</span>
            </div>
            <CompletenessBars />
          </div>

          <div className="split-decor-card">
            <div className="split-decor-card-head">
              <span className="split-decor-icon">
                <Globe aria-hidden />
              </span>
              <div>
                <p className="split-decor-card-title">Strona WWW</p>
                <p className="split-decor-card-sub">Nowy wpis na blogu</p>
              </div>
            </div>
            <p className="split-decor-card-body">
              [Tytuł wpisu przygotowanego przez AI na podstawie briefu]
            </p>
            <div className="split-decor-card-actions">
              <span className="split-decor-chip">
                <Sparkles aria-hidden /> AI
              </span>
              <span className="split-decor-chip is-muted">Edytuj</span>
              <span className="split-decor-chip is-dark">Opublikuj</span>
            </div>
          </div>

          <div className="split-decor-card">
            <div className="split-decor-card-head">
              <span className="split-decor-icon">
                <MessageSquare aria-hidden />
              </span>
              <div>
                <p className="split-decor-card-title">Kampania SMS</p>
                <p className="split-decor-card-sub">Przypomnienie o wizycie</p>
              </div>
              <span className="ui-pill ui-pill-success">Wysłano</span>
            </div>
            <div className="split-decor-stats">
              <span>
                <strong className="mono">128</strong> wysłanych
              </span>
              <span>
                <strong className="mono">94%</strong> dostarczonych
              </span>
            </div>
          </div>
        </div>

        <div className="split-decor-col is-end">
          <div className="split-decor-card">
            <div className="split-decor-card-head">
              <span className="split-decor-icon">
                <LayoutGrid aria-hidden />
              </span>
              <div>
                <p className="split-decor-card-title">Klienci · CRM</p>
                <p className="split-decor-card-sub">Lejek zapytań</p>
              </div>
            </div>
            <div className="split-decor-kanban">
              {[
                { label: "Nowe", count: 4, tone: "warn" },
                { label: "Kontakt", count: 2, tone: "info" },
                { label: "Wygrane", count: 7, tone: "ok" },
              ].map((col) => (
                <div key={col.label} className="split-decor-kanban-col">
                  <p className={`split-decor-kanban-label is-${col.tone}`}>
                    {col.label}{" "}
                    <span className="mono">{col.count}</span>
                  </p>
                  <SkeletonLine />
                  <SkeletonLine wide="mid" />
                  <SkeletonLine wide="short" />
                </div>
              ))}
            </div>
          </div>

          <div className="split-decor-card split-decor-review">
            <span className="split-decor-avatar">AK</span>
            <div className="split-decor-review-text">
              <p className="split-decor-card-title">[Autor opinii]</p>
              <p className="split-decor-card-sub">Czeka na odpowiedź</p>
            </div>
            <span className="split-decor-rating">
              <span className="mono">5</span> <Star aria-hidden />
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function RegisterDecor() {
  const steps = [
    {
      num: "01",
      title: "Konto",
      sub: "Imię, e-mail i hasło",
      time: "30 s",
      tone: "dark",
    },
    {
      num: "02",
      title: "Brief od AI",
      sub: "Ze strony WWW lub opisu firmy",
      time: "1 min",
      tone: "brand",
    },
    {
      num: "03",
      title: "Wizytówka Google",
      sub: "Połącz teraz lub pomiń na później",
      time: "1 min",
      tone: "muted",
    },
  ] as const;

  return (
    <div className="split-decor split-decor-register" aria-hidden>
      {steps.map((step) => (
        <div key={step.num} className="split-decor-step">
          <span className={`split-decor-step-num is-${step.tone} mono`}>
            {step.num}
          </span>
          <div className="split-decor-step-text">
            <p className="split-decor-card-title">{step.title}</p>
            <p className="split-decor-card-sub">{step.sub}</p>
          </div>
          <span className="split-decor-step-time mono">{step.time}</span>
        </div>
      ))}
    </div>
  );
}

function Onboarding1Decor() {
  return (
    <div className="split-decor split-decor-onb1" aria-hidden>
      <div className="split-decor-domain">
        <span className="split-decor-icon is-sm">
          <Globe aria-hidden />
        </span>
        <span className="mono">architekcibiznesu.pl</span>
        <span className="split-decor-reading">
          <span className="split-decor-spinner" />
          Czytam stronę
        </span>
      </div>

      <div className="split-decor-card">
        <div className="split-decor-brief-head">
          <span>
            <Sparkles aria-hidden /> Brief od AI
          </span>
          <span className="split-decor-card-sub">następny krok</span>
        </div>
        {[
          "Usługi",
          "Ton komunikacji",
          "Grupa docelowa",
          "Czym się wyróżniacie",
        ].map((label) => (
          <div key={label} className="split-decor-skel-row">
            <span className="split-decor-card-sub">{label}</span>
            <SkeletonLine />
          </div>
        ))}
      </div>
    </div>
  );
}

function Onboarding2Decor() {
  const items = [
    {
      title: "Publikacje",
      sub: "Tematy i treści postów, bloga i social",
    },
    {
      title: "Odpowiedzi na opinie",
      sub: "Ton i sposób zwracania się do klientów",
    },
    {
      title: "Propozycje do wizytówki",
      sub: "Opis, usługi i produkty w Google",
    },
  ];

  return (
    <div className="split-decor split-decor-onb2" aria-hidden>
      <div className="split-decor-card">
        <p className="split-decor-card-sub">Brief zasila</p>
        {items.map((item) => (
          <div key={item.title} className="split-decor-feed-row">
            <span className="split-decor-icon is-sm">
              <Sparkles aria-hidden />
            </span>
            <div>
              <p className="split-decor-card-title">{item.title}</p>
              <p className="split-decor-card-sub">{item.sub}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="split-decor-note">
        <span className="split-decor-note-check">
          <Check aria-hidden />
        </span>
        Każde pole możesz poprawić teraz albo później w Ustawieniach
      </div>
    </div>
  );
}

function Onboarding3Decor() {
  const chips = [
    "Nazwa i adres",
    "Godziny",
    "Kategorie",
    "Usługi",
    "Opinie",
    "Zdjęcia",
  ];

  return (
    <div className="split-decor split-decor-onb3" aria-hidden>
      <div className="split-decor-card">
        <div className="split-decor-gbp-head">
          <span className="split-decor-card-title">Profil Firmy w Google</span>
          <span className="ui-pill ui-pill-success">Połączono</span>
        </div>
        <div className="split-decor-gbp-photo">[Zdjęcie wizytówki]</div>
        <p className="split-decor-card-title">[Nazwa firmy]</p>
        <p className="split-decor-card-sub">
          [Kategoria] · [ul. Przykładowa 1, Warszawa]
        </p>
        <div className="split-decor-gbp-meta">
          <span className="split-decor-rating">
            <span className="mono">4.9</span> <Star aria-hidden />
          </span>
          <span className="split-decor-card-sub">
            <span className="mono">289</span> opinii
          </span>
        </div>
      </div>

      <div className="split-decor-card">
        <p className="split-decor-card-sub">Pobierzemy z Google</p>
        <div className="split-decor-chips">
          {chips.map((chip) => (
            <span key={chip} className="split-decor-chip is-muted">
              {chip}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export function SplitHeroDecor({ variant }: { variant: SplitDecorVariant }) {
  switch (variant) {
    case "login":
      return <LoginDecor />;
    case "register":
      return <RegisterDecor />;
    case "onboarding-1":
      return <Onboarding1Decor />;
    case "onboarding-2":
      return <Onboarding2Decor />;
    case "onboarding-3":
      return <Onboarding3Decor />;
    default:
      return null;
  }
}
