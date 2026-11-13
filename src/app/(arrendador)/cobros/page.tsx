import type { Metadata } from "next";
import { Suspense } from "react";

import { CollectionsTable } from "@/components/payments/collections-table";
import { MonthPicker } from "@/components/payments/month-picker";
import { getShellData } from "@/server/business/current";
import { limaToday } from "@/server/contracts/dates";
import { getCollections } from "@/server/payments/queries";

export const metadata: Metadata = { title: "Cobros · Gestión de residencias" };

// Cobros, versión simple (decisión del dueño): título, selector de mes y la tabla de recibos del mes.
async function Content({ searchParams }: { searchParams: PageProps<"/cobros">["searchParams"] }) {
  const { current } = await getShellData();
  if (!current) return <p className="text-muted-foreground">Primero configura tu negocio para cobrar.</p>;
  const params = await searchParams;
  const view = await getCollections(current.id, typeof params.mes === "string" ? params.mes : undefined);
  if (!view) return <p className="text-muted-foreground">No encontramos tu negocio. Recarga la página.</p>;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-[34px] font-bold tracking-tight">Cobros</h1>
        <MonthPicker key={view.period} period={view.period} currentPeriod={view.currentPeriod} />
      </div>
      <CollectionsTable key={view.period} view={view} today={limaToday(new Date())} />
    </>
  );
}

export default function CollectionsPage({ searchParams }: PageProps<"/cobros">) {
  return (
    <Suspense fallback={<p className="text-muted-foreground">Cargando…</p>}>
      <Content searchParams={searchParams} />
    </Suspense>
  );
}
