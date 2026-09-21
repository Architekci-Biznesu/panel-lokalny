import Link from "next/link";

export function PlaceholderPage({ title }: { title: string }) {
  return (
    <section className="ui-section">
      <h1 className="text-lg font-semibold text-foreground">{title}</h1>
      <p className="mt-2 text-muted-foreground">
        Wkrótce - ten widok będzie dostępny w kolejnej fazie.
      </p>
      <p className="mt-4 text-sm text-muted-foreground">
        Wróć do{" "}
        <Link href="/pulpit" className="text-brand-deep underline-offset-2 hover:underline">
          pulpitu
        </Link>
        .
      </p>
    </section>
  );
}
