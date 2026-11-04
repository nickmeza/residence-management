import { ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { ViewModeToggle } from "@/components/view-mode-toggle";
import { formatSoles } from "@/lib/format";
import { cn } from "@/lib/utils";
import { floorName } from "@/server/building/floors";
import { STATUS_LABEL, type UnitStatus } from "@/server/building/status";
import { getBuilding, type BuildingUnit } from "@/server/business/queries";

export const metadata: Metadata = { title: "Edificio · Gestión de residencias" };

// Cada estado lleva texto además de color (CLAUDE.md, sección 9).
const STATUS_STYLE: Record<UnitStatus, string> = {
  available: "bg-ok-soft text-ok",
  occupied: "bg-danger-soft text-danger",
  maintenance: "bg-warn-soft text-warn",
};

function StatusChip({ status }: { status: UnitStatus }) {
  return (
    <span
      className={cn("rounded-full px-2.5 py-1 text-xs font-bold whitespace-nowrap", STATUS_STYLE[status])}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

function UnitRow({ unit, note }: { unit: BuildingUnit; note?: string }) {
  return (
    <li className="flex items-center gap-3 border-t px-4 py-3 text-sm">
      <b className="min-w-0 flex-1 truncate">{unit.name}</b>
      {note ? <span className="text-muted-foreground">{note}</span> : <StatusChip status={unit.status} />}
      <span className="w-20 text-right font-bold">
        {note ? "" : (formatSoles(unit.monthlyPrice) ?? "S/ —")}
      </span>
    </li>
  );
}

// Lo que se alquila de cada unidad: un departamento por cuartos se muestra como sus cuartos.
function rentableRows(unit: BuildingUnit) {
  if (unit.type === "apartment" && unit.rentalMode === "by_room")
    return unit.rooms.map((r) => <UnitRow key={r.id} unit={r} />);
  return [<UnitRow key={unit.id} unit={unit} />];
}

async function Content({ params }: { params: PageProps<"/edificio/[id]">["params"] }) {
  const { id } = await params;
  const building = await getBuilding(id);
  if (!building) notFound();
  const { summary } = building;

  return (
    <>
      <div className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">
          {building.name} › <b className="text-foreground">Edificio</b>
        </p>
        <h1 className="text-[34px] font-bold tracking-tight">Edificio</h1>
        <p className="text-muted-foreground">Modo simple: pisos y unidades en acordeones, sin gráficos 3D.</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <ViewModeToggle />
        <span className="rounded-full bg-primary-soft px-3 py-1.5 text-xs font-bold text-primary-text">
          {summary.floors} {summary.floors === 1 ? "piso" : "pisos"} · {summary.rentable} alquilables ·{" "}
          {summary.occupied} {summary.occupied === 1 ? "ocupado" : "ocupados"}
        </span>
      </div>

      {building.floors.length === 0 ? (
        <section className="rounded-xl border bg-card p-6 text-muted-foreground shadow-card">
          Esta propiedad todavía no tiene pisos.
        </section>
      ) : (
        <section className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-card sm:p-5">
          {building.floors.map((floor, i) => {
            const only = floor.units.length === 1 ? floor.units[0] : null;
            const whole = only?.type === "apartment" && only.occupiesWholeFloor ? only : null;
            const byRoomOnly = only?.type === "apartment" && only.rentalMode === "by_room" ? only : null;
            return (
              <details
                key={floor.id}
                open={i === 0}
                className="group overflow-hidden rounded-xl border bg-card"
              >
                <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 px-4 py-3 font-bold">
                  <ChevronRight
                    className="size-4 text-muted-foreground transition-transform duration-200 group-open:rotate-90"
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1">
                    {floorName(floor.level)}
                    {whole ? ` · ${whole.name}` : ""}
                  </span>
                  {whole ? (
                    <>
                      <span className="hidden rounded-full bg-primary-soft px-2.5 py-1 text-xs text-primary-text sm:inline">
                        Ocupa todo el piso
                      </span>
                      {whole.rentalMode === "whole" ? (
                        <b>{formatSoles(whole.monthlyPrice) ?? "S/ —"}</b>
                      ) : null}
                    </>
                  ) : (
                    <span className="text-sm font-medium text-muted-foreground">
                      {byRoomOnly
                        ? "Departamento por cuartos"
                        : `${floor.units.length} ${floor.units.length === 1 ? "unidad" : "unidades"}`}
                    </span>
                  )}
                </summary>
                <ul>{floor.units.flatMap(rentableRows)}</ul>
              </details>
            );
          })}
        </section>
      )}
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
