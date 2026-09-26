/** Shared brand mark used on auth/onboarding and in the app sidebar. */
export function BrandLogo({ className }: { className?: string }) {
  return (
    <span className={className ?? "brand-logo"} aria-hidden>
      <span />
      <span />
    </span>
  );
}
