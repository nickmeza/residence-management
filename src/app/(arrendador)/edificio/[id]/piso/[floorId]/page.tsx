import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { BuildingBreadcrumb } from "@/components/building/building-breadcrumb";
import { rentableUnits, wholeFloorApartment } from "@/components/building/floor-units";
import { buildingHref, floorHref, unitHref } from "@/components/building/building-route";
import { UnitDetail, UnitLinkRow } from "@/components/building/unit-detail";
import { AddUnitButtons } from "@/components/building/unit-page-client";
import { SlabShapeDialog } from "@/components/edificio-3d/slab-shape-dialog";
import { floorName } from "@/server/building/floors";
import { getBuilding } from "@/server/business/queries";

export const metadata: Metadata = { title: "Piso · Gestión de residencias" };

type Props = PageProps<"/edificio/[id]/piso/[floorId]">;

// Página de un piso (modo simple): la lista de sus unidades. Si un departamento ocupa todo el piso, se muestra
// directo ese departamento, igual que el doble clic en el 3D (regla 3).
async function Content({ params, searchParams }: Pick<Props, "params" | "searchParams">) {
  const [{ id, floorId }, query] = await Promise.all([params, searchParams]);
  const building = await getBuilding(id);
  const floor = building?.floors.find((f) => f.id === floorId);
  if (!building || !floor) notFound();

  const whole = wholeFloorApartment(floor.units);
  if (whole) {
    return (
      <UnitDetail
        building={building}
        floor={floor}
        unit={whole}
        parent={null}
        tab={typeof query.pestana === "string" ? query.pestana : undefined}
        basePath={floorHref(building.id, floor.id)}
      />
    );
  }

  const rentable = rentableUnits(floor.units);
  const free = rentable.filter((u) => u.status === "available").length;
  return (
    <>
      <div className="flex flex-col gap-2">
        <BuildingBreadcrumb
          items={[{ label: "Edificio", href: buildingHref(building.id) }, { label: floorName(floor.level) }]}
        />
        <h1 className="text-[34px] font-bold tracking-tight">{floorName(floor.level)}</h1>
        <p className="text-muted-foreground">
          {floor.units.length} {floor.units.length === 1 ? "unidad" : "unidades"} · {rentable.length}{" "}
          {rentable.length === 1 ? "alquilable" : "alquilables"} · {free} {free === 1 ? "libre" : "libres"}
        </p>
      </div>
      {floor.units.length ? (
        <ul className="overflow-hidden rounded-xl border bg-card shadow-card">
          {floor.units.map((u) => (
            <UnitLinkRow key={u.id} href={unitHref(building.id, u.id)} unit={u} />
          ))}
        </ul>
      ) : (
        <p className="rounded-xl border bg-card p-6 text-muted-foreground shadow-card">
          Este piso todavía no tiene unidades. Agrega la primera.
        </p>
      )}
      <div className="flex flex-wrap items-start gap-2">
        <AddUnitButtons floorId={floor.id} />
        <SlabShapeDialog floorId={floor.id} floorLabel={floorName(floor.level)} outline={floor.outline} />
      </div>
    </>
  );
}

export default function FloorPage({ params, searchParams }: Props) {
  return (
    <Suspense fallback={<p className="text-muted-foreground">Cargando el piso…</p>}>
      <Content params={params} searchParams={searchParams} />
    </Suspense>
  );
}
