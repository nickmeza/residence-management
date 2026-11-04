import { Building2, Pencil, Soup } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { buttonVariants } from "@/components/ui/button";
import type { BusinessOverview } from "@/server/business/overview";

const SERVICE_LABEL = { residence: "Residencia", meal_plan: "Pensión" } as const;

// Tarjeta de un negocio con sus propiedades y botones para entrar. La usan el panel y "Mis negocios".
export function BusinessCard({ business: b, action }: { business: BusinessOverview; action?: ReactNode }) {
  return (
    <article className="flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-card">
      <header className="flex flex-wrap items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary-text">
          {b.service === "residence" ? (
            <Building2 className="size-5" aria-hidden="true" />
          ) : (
            <Soup className="size-5" aria-hidden="true" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-lg font-bold">{b.tradeName}</h3>
          <p className="text-sm text-muted-foreground">{SERVICE_LABEL[b.service]}</p>
        </div>
        {action}
        <Link
          href={`/negocio/${b.id}`}
          className={buttonVariants({ variant: "outline", className: "h-11 gap-2 px-3" })}
        >
          <Pencil className="size-4" aria-hidden="true" />
          Editar negocio
        </Link>
      </header>
      {b.service === "residence" ? (
        b.properties.length ? (
          <ul className="flex flex-col gap-2">
            {b.properties.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-3 rounded-lg bg-muted/50 p-3">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">{p.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {p.floors} {p.floors === 1 ? "piso" : "pisos"} · {p.apartments}{" "}
                    {p.apartments === 1 ? "departamento" : "departamentos"} · {p.rentable} alquilables
                  </div>
                </div>
                <Link href={`/edificio/${p.id}`} className={buttonVariants({ className: "h-11 px-4" })}>
                  Ver edificio
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Sin propiedades todavía.</p>
        )
      ) : (
        <p className="text-sm text-muted-foreground">
          El menú, los planes y la cocina llegan en la fase de Pensión.
        </p>
      )}
    </article>
  );
}
