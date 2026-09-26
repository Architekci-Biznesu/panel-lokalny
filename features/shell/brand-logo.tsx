/**
 * Shared brand mark (styl 4, znak PL-3): pień P + pierścień + stopka L,
 * półprzezroczyste nakładanie, koralowy punkt = lokalna firma.
 * Identyczne definicje gradientów przy wielu instancjach są bezpieczne.
 */
export function BrandLogo({ className }: { className?: string }) {
  return (
    <span className={className ?? "brand-logo"} aria-hidden>
      <svg viewBox="0 0 48 48" width="100%" height="100%" focusable="false">
        <defs>
          <linearGradient id="pl-logo-stem" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#3730a3" />
            <stop offset="1" stopColor="#4f46e5" />
          </linearGradient>
          <linearGradient id="pl-logo-bowl" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#4338ca" />
            <stop offset="1" stopColor="#6366f1" />
          </linearGradient>
          <linearGradient id="pl-logo-foot" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#6366f1" />
            <stop offset="1" stopColor="#a5b4fc" />
          </linearGradient>
        </defs>
        <rect
          x="7"
          y="5"
          width="11"
          height="38"
          rx="5.5"
          fill="url(#pl-logo-stem)"
        />
        <circle
          cx="27"
          cy="17"
          r="10"
          fill="none"
          stroke="url(#pl-logo-bowl)"
          strokeWidth="6"
          opacity="0.85"
        />
        <rect
          x="7"
          y="32"
          width="35"
          height="11"
          rx="5.5"
          fill="url(#pl-logo-foot)"
          opacity="0.72"
        />
        <circle cx="27" cy="17" r="3" fill="#f26b3a" />
      </svg>
    </span>
  );
}
