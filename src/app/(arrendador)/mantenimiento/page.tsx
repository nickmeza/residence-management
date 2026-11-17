import type { Metadata } from "next";
import { Suspense } from "react";

import { MaintenanceList } from "@/components/maintenance/maintenance-list";
import { NewRequestButton } from "@/components/maintenance/new-request-button";
import { MAINTENANCE_TABS, SectionTabs } from "@/components/section-tabs";
import { floorName } from "@/server/building/floors";
import { getShellData } from "@/server/business/current";
import { listRequests, listUnitOptions } from "@/server/maintenance/queries";

export const metadata: Metadata = { title: "Mantenimiento · Gestión de residencias" };

async function Content() {
  const { current } = await getShellData();
  if (!current) return <p className="text-muted-foreground">Primero configura tu negocio.</p>;
  if (current.service !== "residence") {
    return <p className="text-muted-foreground">Mantenimiento es de un negocio de Residencia.</p>;
  }
  const [rows, units] = await Promise.all([listRequests(current.id), listUnitOptions(current.id)]);
  if (!rows) return <p className="text-muted-foreground">No encontramos tu negocio. Recarga la página.</p>;
  const many = current.properties.length > 1;
  return (
    <MaintenanceList
      rows={rows}
      now={new Date()}
      action={
        <NewRequestButton
          businessId={current.id}
          units={units.map((u) => ({
            id: u.id,
            label: `${many ? `${u.propertyName} · ` : ""}${floorName(u.level)} · ${u.name}`,
          }))}
        />
      }
    />
  );
}

// Mantenimiento (MT-02): los pedidos del negocio, los activos y urgentes primero.
export default function MaintenancePage() {
  return (
    <>
      <h1 className="text-[34px] font-bold tracking-tight">Mantenimiento</h1>
      <SectionTabs tabs={MAINTENANCE_TABS} current="pedidos" label="Secciones de mantenimiento" />
      <Suspense fallback={<p className="text-muted-foreground">Cargando…</p>}>
        <Content />
      </Suspense>
    </>
  );
}
