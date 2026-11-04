import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { BuildingScreenLoader } from "@/components/building/building-screen-loader";
import { getBuilding } from "@/server/business/queries";

export const metadata: Metadata = { title: "Edificio · Gestión de residencias" };

// Lee los datos con la sesión (RLS): va dentro de <Suspense>. Al guardar un cambio, la acción vuelve a
// pedir esta página y el editor recibe los datos nuevos.
async function Content({ params }: { params: PageProps<"/edificio/[id]">["params"] }) {
  const { id } = await params;
  const building = await getBuilding(id);
  if (!building) notFound();

  return (
    <>
      <div className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">
          {building.name} › <b className="text-foreground">Edificio</b>
        </p>
        <h1 className="text-[34px] font-bold tracking-tight">Edificio</h1>
        <p className="text-muted-foreground">
          Tu propiedad en 3D o en modo simple. Toca una unidad para ver y editar sus datos.
        </p>
      </div>
      <BuildingScreenLoader building={building} />
    </>
  );
}

export default function BuildingPage({ params }: PageProps<"/edificio/[id]">) {
  return (
    <Suspense fallback={<p className="text-muted-foreground">Cargando el edificio…</p>}>
      <Content params={params} />
    </Suspense>
  );
}
