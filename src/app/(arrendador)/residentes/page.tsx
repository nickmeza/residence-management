import type { Metadata } from "next";
import { Suspense } from "react";

import { ResidentList } from "@/components/residents/resident-list";
import { getShellData } from "@/server/business/current";
import { isActivePhase } from "@/server/residents/list";
import { listResidents } from "@/server/residents/queries";

export const metadata: Metadata = { title: "Residentes · Gestión de residencias" };

function Stat({ label, value, note }: { label: string; value: number; note: string }) {
  return (
    <div className="rounded-xl border bg-card px-5 py-4 shadow-card">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="mt-1 text-[28px] font-bold">{value}</div>
      <div className="text-sm text-muted-foreground">{note}</div>
    </div>
  );
}

// La lista sigue al negocio elegido arriba.
async function Content() {
  const { current } = await getShellData();
  if (!current) {
    return <p className="text-muted-foreground">Primero configura tu negocio para agregar residentes.</p>;
  }
  const rows = await listResidents(current.id);
  const active = rows.filter((r) => isActivePhase(r.phase)).length;
  const toReview = rows.filter((r) => r.documents.inReview > 0);

  return (
    <>
      <div className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">
          {current.tradeName} › <b className="text-foreground">Residentes</b>
        </p>
        <h1 className="text-[34px] font-bold tracking-tight">Residentes</h1>
        <p className="text-muted-foreground">Quién vive en tu propiedad, sus contratos y sus documentos.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Stat label="Residentes activos" value={active} note={`de ${rows.length} en tu lista`} />
        <Stat
          label="Documentos por revisar"
          value={toReview.reduce((n, r) => n + r.documents.inReview, 0)}
          note={toReview.length ? toReview.map((r) => r.fullName).join(", ") : "Nada pendiente"}
        />
      </div>
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
