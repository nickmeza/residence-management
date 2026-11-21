import type { Metadata } from "next";
import { Suspense } from "react";

import { VisitBoard } from "@/components/reception/visit-board";
import { RECEPTION_TABS, SectionTabs } from "@/components/section-tabs";
import { ListSkeleton } from "@/components/skeletons";
import { getShellData } from "@/server/business/current";
import { listVisits } from "@/server/reception/queries";

export const metadata: Metadata = { title: "Visitas · Gestión de residencias" };

async function Content() {
  const { current } = await getShellData();
  if (!current) return <p className="text-muted-foreground">Primero configura tu negocio.</p>;
  if (current.service !== "residence") {
    return <p className="text-muted-foreground">Visitas y paquetes son de un negocio de Residencia.</p>;
  }
  const data = await listVisits(current.id);
  if (!data) return <p className="text-muted-foreground">No encontramos tu negocio. Recarga la página.</p>;
  return <VisitBoard businessId={current.id} rows={data.rows} residents={data.residents} />;
}

// Visitas (CM-05): quién entró, a quién visita y cuándo salió.
export default function VisitsPage() {
  return (
    <>
      <h1 className="text-[34px] font-bold tracking-tight">Visitas y paquetes</h1>
      <SectionTabs tabs={RECEPTION_TABS} current="visitas" label="Visitas y paquetes" />
      <Suspense fallback={<ListSkeleton />}>
        <Content />
      </Suspense>
    </>
  );
}
