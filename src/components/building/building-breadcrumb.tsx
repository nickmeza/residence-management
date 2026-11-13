import { ChevronLeft } from "lucide-react";
import Link from "next/link";

export type Crumb = { label: string; href?: string };

// Migas de pan del edificio (Edificio › Piso 1 › Cuarto 101). El último paso es la página actual. En móvil se
// reducen a "‹ paso anterior" para no ocupar dos líneas.
export function BuildingBreadcrumb({ items }: { items: Crumb[] }) {
  const parent = [...items].reverse().find((c, i) => i > 0 && c.href);
  return (
    <nav aria-label="Ruta" className="text-sm text-muted-foreground">
      {parent?.href ? (
        <Link
          href={parent.href}
          className="inline-flex min-h-11 items-center gap-1 font-semibold text-link sm:hidden"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
          {parent.label}
        </Link>
      ) : null}
      <ol className="hidden flex-wrap items-center gap-1.5 sm:flex">
        {items.map((c, i) => {
          const last = i === items.length - 1;
          return (
            <li key={`${c.label}-${i}`} className="flex items-center gap-1.5">
              {last ? (
                <b aria-current="page" className="text-foreground">
                  {c.label}
                </b>
              ) : c.href ? (
                <Link href={c.href} className="underline-offset-4 hover:text-foreground hover:underline">
                  {c.label}
                </Link>
              ) : (
                <span>{c.label}</span>
              )}
              {last ? null : <span aria-hidden="true">›</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
