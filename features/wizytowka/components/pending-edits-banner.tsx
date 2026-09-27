import { ArrowUpRight, Hourglass } from "lucide-react";

/**
 * Pasek pod podglądem wizytówki, gdy Google wciąż przetwarza edycje
 * (metadata.hasPendingEdits). Informacja, nie decyzja - dlatego poza blokiem "Do Twojej decyzji".
 */
export function PendingEditsBanner({ mapsUri }: { mapsUri?: string | null }) {
  return (
    <div className="wiz-pending" role="status">
      <span className="wiz-pending-icon" aria-hidden>
        <Hourglass />
      </span>
      <div className="wiz-pending-copy">
        <p className="wiz-pending-title">Oczekujące zmiany w Google</p>
        <p className="wiz-pending-desc">
          Google wciąż przetwarza edycje - sprawdź status w Profilu Firmy.
        </p>
      </div>
      {mapsUri ? (
        <a
          href={mapsUri}
          target="_blank"
          rel="noopener noreferrer"
          className="ui-btn ui-btn-white ui-btn-sm wiz-pending-link"
        >
          Sprawdź status
          <ArrowUpRight aria-hidden />
        </a>
      ) : null}
    </div>
  );
}
