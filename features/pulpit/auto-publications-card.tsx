import Link from "next/link";
import { ChevronRight } from "lucide-react";

export function AutoPublicationsCard() {
  return (
    <section className="pulpit-auto">
      <h2 className="pulpit-auto-title">Automatyczne publikacje</h2>
      <p className="pulpit-auto-lead">
        Dodatek ze Sklepu - AI przygotowuje i publikuje posty na wizytówce co
        tydzień.
      </p>
      <Link href="/sklep" className="pulpit-auto-cta">
        <span>Zobacz w Sklepie</span>
        <ChevronRight aria-hidden />
      </Link>
    </section>
  );
}
