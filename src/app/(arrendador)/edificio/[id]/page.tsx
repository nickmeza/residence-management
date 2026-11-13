import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { BuildingEditor } from "@/components/building/building-editor";
import { CoverPhotoCard } from "@/components/building/cover-photo-card";
import { coverUrl } from "@/server/building/cover";
import { getBuilding } from "@/server/business/queries";

export const metadata: Metadata = { title: "Edificio · Gestión de residencias" };

// Lee los datos con la sesión (RLS): va dentro de <Suspense>. Al guardar un cambio, la acción vuelve a
// pedir esta página y el editor recibe los datos nuevos. El 3D y el interruptor están en el marco (layout.tsx).
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
          Tu propiedad en 3D o en modo simple. Entra a un piso para ver sus unidades.
        </p>
      </div>
      <BuildingEditor building={building} />
      <CoverPhotoCard
        propertyId={building.id}
        businessId={building.businessId}
        url={await coverUrl(building.coverPhotoPath)}
      />
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
