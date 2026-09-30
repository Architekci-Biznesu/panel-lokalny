export type SplitDecorVariant = "register";

const REGISTER_STEPS = [
  { num: "01", title: "Konto", sub: "Imię, e-mail i hasło", time: "30 s" },
  {
    num: "02",
    title: "Brief od AI",
    sub: "AI czyta Twoją stronę albo opis firmy",
    time: "1 min",
  },
  {
    num: "03",
    title: "Wizytówka Google",
    sub: "Połącz teraz lub pomiń na później",
    time: "1 min",
  },
] as const;

/** Rejestracja: matowa szyba na zdjęciu z osią trzech kroków (pierwszy trwa). */
function RegisterDecor() {
  return (
    <div className="split-decor" aria-hidden>
      <div className="split-glass split-steps">
        <div className="split-steps-head">
          <span className="split-glass-label">Twoja konfiguracja</span>
          <span className="mono">krok 1 z 3</span>
        </div>
        <span className="split-steps-progress">
          <span />
        </span>
        <ol className="split-steps-list">
          {REGISTER_STEPS.map((step, index) => (
            <li
              key={step.num}
              className={`split-step${index === 0 ? " is-active" : ""}`}
            >
              <span className="split-step-num mono">{step.num}</span>
              <span className="split-step-text">
                <span className="split-step-title">
                  {step.title}
                  {index === 0 ? (
                    <span className="split-step-now">teraz</span>
                  ) : null}
                </span>
                <span className="split-step-sub">{step.sub}</span>
              </span>
              <span className="split-step-time mono">{step.time}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

export function SplitHeroDecor({ variant }: { variant: SplitDecorVariant }) {
  switch (variant) {
    case "register":
      return <RegisterDecor />;
    default:
      return null;
  }
}
