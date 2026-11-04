import { Building2, Pencil, Soup } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { buttonVariants } from "@/components/ui/button";
import { greetingFor, greetingName } from "@/lib/greeting";
import { getShellData } from "@/server/business/current";
import { getMyOverview } from "@/server/business/overview";

export const metadata: Metadata = { title: "Panel · Gestión de residencias" };

const SERVICE_LABEL = { residence: "Residencia", meal_plan: "Pensión" } as const;

// "Buenos días" en la letra caligráfica (Great Vibes, solo para saludos) y el nombre con el primer apellido.
async function Greeting() {
  const { fullName, current } = await getShellData();
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-muted-foreground">
        {current ? `${current.tradeName} › ` : ""}
        <b className="text-foreground">Panel</b>
      </p>
      <h1 className="text-[34px] font-bold tracking-tight">
        <span className="font-script text-[56px] leading-tight font-normal tracking-normal text-primary">
          {greetingFor(new Date())}
        </span>
        , {greetingName(fullName)}
      </h1>
      <p className="text-muted-foreground">Esto es lo que necesita tu atención hoy.</p>
    </div>
  );
}

async function Businesses() {
  const { businesses } = await getMyOverview();
  if (!businesses.length) {
    return (
      <section className="flex flex-col items-start gap-3 rounded-xl border bg-card p-6 shadow-card">
        <h2 className="text-lg font-bold">Todavía no configuraste tu negocio</h2>
        <p className="text-muted-foreground">
          Elige tus servicios, registra los datos de tu negocio y arma tu propiedad.
        </p>
        <Link href="/configurar" className={buttonVariants({ className: "h-11 px-4" })}>
          Configurar mi negocio
        </Link>
      </section>
    );
  }
  return (
    <section className="flex flex-col gap-4" aria-labelledby="mis-negocios">
      <h2 id="mis-negocios" className="text-lg font-bold">
        Tus negocios
      </h2>
      <div className="grid gap-5 md:grid-cols-2">
        {businesses.map((b) => (
          <article key={b.id} className="flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-card">
            <header className="flex items-start gap-3">
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
                          {p.floors} {p.floors === 1 ? "piso" : "pisos"} · {p.rentable} alquilables
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
        ))}
      </div>
    </section>
  );
}

export default function PanelPage() {
  return (
    <>
      <Suspense fallback={<p className="text-muted-foreground">Cargando…</p>}>
        <Greeting />
      </Suspense>
      <Suspense fallback={<p className="text-muted-foreground">Cargando tus negocios…</p>}>
        <Businesses />
      </Suspense>
    </>
  );
}
