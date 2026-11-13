import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { locateUnit } from "@/components/building/floor-units";
import { unitHref } from "@/components/building/building-route";
import { UnitDetail } from "@/components/building/unit-detail";
import { getBuilding } from "@/server/business/queries";

export const metadata: Metadata = { title: "Unidad · Gestión de residencias" };

type Props = PageProps<"/edificio/[id]/unidad/[unitId]">;

// Página de un cuarto o departamento, con sus pestañas (Datos, Cuartos, Residente). La pestaña va en la
// dirección (?pestana=residente) para que "Atrás" y los enlaces directos funcionen.
async function Content({ params, searchParams }: Pick<Props, "params" | "searchParams">) {
  const [{ id, unitId }, query] = await Promise.all([params, searchParams]);
  const building = await getBuilding(id);
  const found = building ? locateUnit(building, unitId) : null;
  if (!building || !found) notFound();

  return (
    <UnitDetail
      building={building}
      floor={found.floor}
      unit={found.unit}
      parent={found.parent}
      tab={typeof query.pestana === "string" ? query.pestana : undefined}
      basePath={unitHref(building.id, found.unit.id)}
    />
  );
}

export default function UnitPage({ params, searchParams }: Props) {
  return (
    <Suspense fallback={<p className="text-muted-foreground">Cargando la unidad…</p>}>
      <Content params={params} searchParams={searchParams} />
    </Suspense>
  );
}
