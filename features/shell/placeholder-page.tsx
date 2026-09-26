import Link from "next/link";

export function PlaceholderPage({ title }: { title: string }) {
  return (
    <section className="ui-section">
      <div className="page-header">
        <div>
          <h1>{title}</h1>
          <p>Wkrótce - ten widok będzie dostępny w kolejnej fazie.</p>
        </div>
      </div>
      <p className="mt-4 text-sm text-muted-foreground">
        Wróć do{" "}
        <Link
          href="/pulpit"
          className="text-brand-deep underline-offset-2 hover:underline"
        >
          pulpitu
        </Link>
        .
      </p>
    </section>
  );
}
