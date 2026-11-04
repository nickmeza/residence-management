import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { SignOutButton } from "@/components/auth/sign-out-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { buttonVariants } from "@/components/ui/button";
import { getMyOverview } from "@/server/business/overview";

export const metadata: Metadata = { title: "Panel · Gestión de residencias" };

const SERVICE_LABEL = { residence: "Residencia", meal_plan: "Pensión" } as const;

// Lee la sesión y los datos (con RLS); por eso va dentro de <Suspense>.
async function Overview() {
  const { fullName, businesses } = await getMyOverview();
  return (
    <>
      <h1 className="text-[34px] font-bold tracking-tight">Hola, {fullName}</h1>
      {businesses.length === 0 ? (
        <section className="flex flex-col items-start gap-3 rounded-xl border bg-card p-6 shadow-card">
          <h2 className="text-lg font-bold">Todavía no configuraste tu negocio</h2>
          <p className="text-muted-foreground">
            Elige tus servicios, registra los datos de tu negocio y arma tu propiedad.
          </p>
          <Link href="/configurar" className={buttonVariants({ className: "h-11 px-4" })}>
            Configurar mi negocio
          </Link>
        </section>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {businesses.map((b) => (
            <section key={b.id} className="flex flex-col gap-3 rounded-xl border bg-card p-5 shadow-card">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-lg font-bold">{b.tradeName}</h2>
                <span className="rounded-full bg-chip px-2.5 py-1 text-xs font-bold text-chip-foreground">
                  {SERVICE_LABEL[b.service]}
                </span>
              </div>
              {b.service === "residence" ? (
                b.properties.length ? (
                  <ul className="flex flex-col gap-2">
                    {b.properties.map((p) => (
                      <li key={p.id} className="rounded-lg bg-muted/50 p-3">
                        <div className="font-semibold">{p.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {p.floors} {p.floors === 1 ? "piso" : "pisos"} · {p.apartments}{" "}
                          {p.apartments === 1 ? "departamento" : "departamentos"} · {p.rentable} que se
                          alquilan
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">Sin propiedades todavía.</p>
                )
              ) : (
                <p className="text-sm text-muted-foreground">
                  La pensión se configura en una fase posterior.
                </p>
              )}
            </section>
          ))}
        </div>
      )}
    </>
  );
}

export default function PanelPage() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-8 sm:px-8">
      <header className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">Panel del arrendador</p>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <SignOutButton />
        </div>
      </header>
      <Suspense fallback={<p className="text-muted-foreground">Cargando tu panel…</p>}>
        <Overview />
      </Suspense>
    </main>
  );
}
