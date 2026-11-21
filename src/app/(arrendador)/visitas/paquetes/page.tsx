import type { Metadata } from "next";
import { Suspense } from "react";

import { ParcelBoard } from "@/components/reception/parcel-board";
import { RECEPTION_TABS, SectionTabs } from "@/components/section-tabs";
import { ListSkeleton } from "@/components/skeletons";
import { getShellData } from "@/server/business/current";
import { listParcels } from "@/server/reception/queries";

export const metadata: Metadata = { title: "Paquetes · Gestión de residencias" };

async function Content() {
  const { current } = await getShellData();
  if (!current) return <p className="text-muted-foreground">Primero configura tu negocio.</p>;
  if (current.service !== "residence") {
    return <p className="text-muted-foreground">Visitas y paquetes son de un negocio de Residencia.</p>;
  }
  const data = await listParcels(current.id);
  if (!data) return <p className="text-muted-foreground">No encontramos tu negocio. Recarga la página.</p>;
  return <ParcelBoard businessId={current.id} rows={data.rows} residents={data.residents} />;
}

// Paquetes (CM-06): lo que llegó para cada residente y si ya lo recogió.
export default function ParcelsPage() {
  return (
    <>
      <h1 className="text-[34px] font-bold tracking-tight">Visitas y paquetes</h1>
      <SectionTabs tabs={RECEPTION_TABS} current="paquetes" label="Visitas y paquetes" />
      <Suspense fallback={<ListSkeleton />}>
        <Content />
      </Suspense>
    </>
  );
}
