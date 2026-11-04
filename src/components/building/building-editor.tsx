"use client";

import { ArrowDown, ArrowUp, ChevronRight, Plus } from "lucide-react";
import { useState, useTransition } from "react";

import { FormMessage } from "@/components/auth/auth-field";
import { ConfirmButton } from "@/components/confirm-button";
import { Button } from "@/components/ui/button";
import { ViewModeToggle } from "@/components/view-mode-toggle";
import { formatSoles } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  addFloorAction,
  addUnitAction,
  deleteFloorAction,
  moveFloorAction,
  type BuildingResult,
} from "@/server/building/actions";
import { floorName } from "@/server/building/floors";
import { STATUS_LABEL, type UnitStatus } from "@/server/building/status";
import type { BuildingUnit, BuildingView } from "@/server/business/queries";

import { UnitSheet, type SheetTarget } from "./unit-sheet";

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

// Fila del acordeón: al tocarla se abre el panel para editar esa unidad.
function UnitRow({
  unit,
  note,
  nested,
  onOpen,
}: {
  unit: BuildingUnit;
  note?: string;
  nested?: boolean;
  onOpen: (id: string) => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(unit.id)}
        className={cn(
          "flex min-h-12 w-full items-center gap-3 border-t px-4 py-2.5 text-left text-sm transition-colors duration-200 hover:bg-muted/60",
          nested && "pl-9",
        )}
      >
        <b className="min-w-0 flex-1 truncate">{unit.name}</b>
        {note ? <span className="text-muted-foreground">{note}</span> : <StatusChip status={unit.status} />}
        <span className="w-20 text-right font-bold">
          {note ? "" : (formatSoles(unit.monthlyPrice) ?? "S/ —")}
        </span>
        <span className="hidden text-link sm:inline">Editar</span>
      </button>
    </li>
  );
}

// Un departamento y sus cuartos. Por cuartos: se alquila cada cuarto. Completo: los cuartos solo describen.
function ApartmentRows({ unit, onOpen }: { unit: BuildingUnit; onOpen: (id: string) => void }) {
  const byRoom = unit.rentalMode === "by_room";
  return (
    <>
      <UnitRow unit={unit} note={byRoom ? "Por cuartos" : undefined} onOpen={onOpen} />
      {unit.rooms.map((r) => (
        <UnitRow key={r.id} unit={r} nested note={byRoom ? undefined : "Incluido"} onOpen={onOpen} />
      ))}
    </>
  );
}

export function BuildingEditor({ building }: { building: BuildingView }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [message, setMessage] = useState<string>();
  const [pending, startTransition] = useTransition();
  const { summary } = building;

  const act = (action: () => Promise<BuildingResult>) =>
    startTransition(async () => {
      const result = await action();
      setMessage(result.ok ? undefined : result.message);
    });

  // Busca la unidad elegida (o un cuarto dentro de un departamento) en los datos actuales.
  let target: SheetTarget | null = null;
  for (const f of building.floors) {
    for (const u of f.units) {
      const base = { floorLabel: floorName(f.level), onlyUnit: f.units.length === 1 };
      if (u.id === selectedId) target = { ...base, unit: u, parent: null };
      const room = u.rooms.find((r) => r.id === selectedId);
      if (room) target = { ...base, unit: room, parent: u };
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <ViewModeToggle />
        <span className="rounded-full bg-primary-soft px-3 py-1.5 text-xs font-bold text-primary-text">
          {summary.floors} {summary.floors === 1 ? "piso" : "pisos"} · {summary.rentable} alquilables ·{" "}
          {summary.occupied} {summary.occupied === 1 ? "ocupado" : "ocupados"}
        </span>
        <span className="flex-1" />
        <Button
          type="button"
          className="h-11 gap-2 px-4"
          disabled={pending}
          onClick={() => act(() => addFloorAction(building.id))}
        >
          <Plus className="size-4" aria-hidden="true" />
          Agregar piso
        </Button>
      </div>
      <FormMessage message={message} />
      {pending ? (
        <p role="status" className="text-sm text-muted-foreground">
          Guardando…
        </p>
      ) : null}

      {building.floors.length === 0 ? (
        <section className="rounded-xl border bg-card p-6 text-muted-foreground shadow-card">
          Esta propiedad todavía no tiene pisos. Agrega el primero con “Agregar piso”.
        </section>
      ) : (
        <section className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-card sm:p-5">
          {building.floors.map((floor) => {
            const only = floor.units.length === 1 ? floor.units[0] : null;
            const whole = only?.type === "apartment" && only.occupiesWholeFloor ? only : null;
            const isTop = floor.level === building.floors.length;
            const isBottom = floor.level === 1;
            return (
              <details key={floor.id} open className="group overflow-hidden rounded-xl border bg-card">
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
                    <span className="hidden rounded-full bg-primary-soft px-2.5 py-1 text-xs text-primary-text sm:inline">
                      Ocupa todo el piso
                    </span>
                  ) : (
                    <span className="text-sm font-medium text-muted-foreground">
                      {floor.units.length} {floor.units.length === 1 ? "unidad" : "unidades"}
                    </span>
                  )}
                </summary>

                <ul>
                  {floor.units.map((u) =>
                    u.type === "apartment" ? (
                      <ApartmentRows key={u.id} unit={u} onOpen={setSelectedId} />
                    ) : (
                      <UnitRow key={u.id} unit={u} onOpen={setSelectedId} />
                    ),
                  )}
                  {floor.units.length === 0 ? (
                    <li className="border-t px-4 py-3 text-sm text-muted-foreground">
                      Este piso todavía no tiene unidades.
                    </li>
                  ) : null}
                </ul>

                <div className="flex flex-wrap items-center gap-2 border-t bg-muted/30 px-4 py-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 gap-1"
                    disabled={pending}
                    onClick={() => act(() => addUnitAction(floor.id, "apartment"))}
                  >
                    <Plus className="size-4" aria-hidden="true" />
                    Departamento
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 gap-1"
                    disabled={pending}
                    onClick={() => act(() => addUnitAction(floor.id, "room"))}
                  >
                    <Plus className="size-4" aria-hidden="true" />
                    Cuarto
                  </Button>
                  <span className="flex-1" />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-11"
                    aria-label={`Pasar ${floorName(floor.level)} a ${floorName(floor.level + 1)}`}
                    title={`Pasar a ${floorName(floor.level + 1)}`}
                    disabled={pending || isTop}
                    onClick={() => act(() => moveFloorAction(floor.id, "up"))}
                  >
                    <ArrowUp className="size-4" aria-hidden="true" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-11"
                    aria-label={`Pasar ${floorName(floor.level)} a ${floorName(floor.level - 1)}`}
                    title={`Pasar a ${floorName(floor.level - 1)}`}
                    disabled={pending || isBottom}
                    onClick={() => act(() => moveFloorAction(floor.id, "down"))}
                  >
                    <ArrowDown className="size-4" aria-hidden="true" />
                  </Button>
                  <ConfirmButton
                    trigger={
                      <Button type="button" variant="ghost" className="h-11" disabled={pending}>
                        Quitar piso
                      </Button>
                    }
                    title={`¿Quitar ${floorName(floor.level)}?`}
                    description="Se quitan también todas sus unidades y los pisos de arriba bajan un nivel. No se puede deshacer."
                    confirmLabel="Quitar piso"
                    onConfirm={() => act(() => deleteFloorAction(floor.id))}
                  />
                </div>
              </details>
            );
          })}
        </section>
      )}

      <UnitSheet target={target} onClose={() => setSelectedId(null)} onSelect={setSelectedId} />
    </>
  );
}
