import type { Metadata } from "next";
import { Suspense } from "react";

import { ResidentList } from "@/components/residents/resident-list";
import { getShellData } from "@/server/business/current";
import { listResidents } from "@/server/residents/queries";

export const metadata: Metadata = { title: "Residentes · Gestión de residencias" };

// Residentes, versión simple (decisión del dueño): título y la tabla. La lista sigue al negocio elegido arriba.
async function Content() {
  const { current } = await getShellData();
  if (!current) {
    return <p className="text-muted-foreground">Primero configura tu negocio para agregar residentes.</p>;
  }
  const rows = await listResidents(current.id);

  return (
    <>
      <h1 className="text-[34px] font-bold tracking-tight">Residentes</h1>
      <ResidentList rows={rows} />
    </>
  );
}

export default function ResidentsPage() {
  return (
    <Suspense fallback={<p className="text-muted-foreground">Cargando residentes…</p>}>
      <Content />
    </Suspense>
  );
}
