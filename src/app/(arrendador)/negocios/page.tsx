import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { BusinessCard } from "@/components/business/business-card";
import { OpenBusinessButton } from "@/components/business/open-business-button";
import { buttonVariants } from "@/components/ui/button";
import { getShellData } from "@/server/business/current";
import { getMyOverview } from "@/server/business/overview";

export const metadata: Metadata = { title: "Mis negocios · Gestión de residencias" };

async function List() {
  const [{ current }, { businesses }] = await Promise.all([getShellData(), getMyOverview()]);
  if (!businesses.length) {
    return (
      <section className="flex flex-col items-start gap-3 rounded-xl border bg-card p-6 shadow-card">
        <p className="text-muted-foreground">Todavía no tienes negocios.</p>
        <Link href="/configurar" className={buttonVariants({ className: "h-11 px-4" })}>
          Configurar mi negocio
        </Link>
      </section>
    );
  }
  return (
    <div className="grid gap-5 md:grid-cols-2">
      {businesses.map((b) => (
        <BusinessCard
          key={b.id}
          business={b}
          action={<OpenBusinessButton id={b.id} current={b.id === current?.id} />}
        />
      ))}
    </div>
  );
}

// Todos los negocios del arrendador. "Abrir" hace lo mismo que el selector de arriba.
export default function BusinessesPage() {
  return (
    <>
      <div className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">
          <b className="text-foreground">Mis negocios</b>
        </p>
        <h1 className="text-[34px] font-bold tracking-tight">Mis negocios</h1>
        <p className="text-muted-foreground">Cada negocio tiene sus propios datos, cobros y propiedades.</p>
      </div>
      <Suspense fallback={<p className="text-muted-foreground">Cargando tus negocios…</p>}>
        <List />
      </Suspense>
    </>
  );
}
