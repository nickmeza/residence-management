import type { Metadata } from "next";
import { Suspense } from "react";

import { MAINTENANCE_TABS, SectionTabs } from "@/components/section-tabs";
import { SupplierList } from "@/components/tasks/supplier-list";
import { getShellData } from "@/server/business/current";
import { listSuppliers } from "@/server/tasks/queries";

export const metadata: Metadata = { title: "Proveedores · Gestión de residencias" };

async function Content() {
  const { current } = await getShellData();
  if (!current) return <p className="text-muted-foreground">Primero configura tu negocio.</p>;
  if (current.service !== "residence") {
    return <p className="text-muted-foreground">Mantenimiento es de un negocio de Residencia.</p>;
  }
  const rows = await listSuppliers(current.id);
  if (!rows) return <p className="text-muted-foreground">No encontramos tu negocio. Recarga la página.</p>;
  return <SupplierList businessId={current.id} rows={rows} />;
}

// Proveedores (MT-06): directorio de quienes arreglan o limpian, con su historial.
export default function SuppliersPage() {
  return (
    <>
      <h1 className="text-[34px] font-bold tracking-tight">Mantenimiento</h1>
      <SectionTabs tabs={MAINTENANCE_TABS} current="proveedores" label="Secciones de mantenimiento" />
      <Suspense fallback={<p className="text-muted-foreground">Cargando…</p>}>
        <Content />
      </Suspense>
    </>
  );
}
