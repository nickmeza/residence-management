import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { BusinessCard } from "@/components/business/business-card";
import { buttonVariants } from "@/components/ui/button";
import { greetingFor, greetingName } from "@/lib/greeting";
import { getShellData } from "@/server/business/current";
import { getMyOverview } from "@/server/business/overview";

export const metadata: Metadata = { title: "Panel · Gestión de residencias" };

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

// El panel sigue al negocio elegido arriba (como el proyecto elegido en GCP).
async function CurrentBusiness() {
  const [{ current }, { businesses }] = await Promise.all([getShellData(), getMyOverview()]);
  const shown = businesses.find((b) => b.id === current?.id);
  if (!shown) {
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
    <section className="flex flex-col gap-4" aria-labelledby="negocio-actual">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="negocio-actual" className="text-lg font-bold">
          Tu negocio
        </h2>
        {businesses.length > 1 ? (
          <Link
            href="/negocios"
            className="text-sm font-semibold text-link underline-offset-4 hover:underline"
          >
            Ver todos mis negocios ({businesses.length})
          </Link>
        ) : null}
      </div>
      <BusinessCard business={shown} />
    </section>
  );
}

export default function PanelPage() {
  return (
    <>
      <Suspense fallback={<p className="text-muted-foreground">Cargando…</p>}>
        <Greeting />
      </Suspense>
      <Suspense fallback={<p className="text-muted-foreground">Cargando tu negocio…</p>}>
        <CurrentBusiness />
      </Suspense>
    </>
  );
}
