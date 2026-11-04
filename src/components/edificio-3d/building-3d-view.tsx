"use client";

import { ArrowLeft, Plus } from "lucide-react";
import { useEffect, useState, useTransition, type ReactNode } from "react";

import { FormMessage } from "@/components/auth/auth-field";
import { findSheetTarget } from "@/components/building/sheet-target";
import { UnitSheet } from "@/components/building/unit-sheet";
import { Button } from "@/components/ui/button";
import { formatSoles } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  addFloorAction,
  addRoomAction,
  addUnitAction,
  moveFloorToAction,
  moveUnitAction,
  type BuildingResult,
} from "@/server/building/actions";
import { floorName } from "@/server/building/floors";
import { STATUS_LABEL, type UnitStatus } from "@/server/building/status";
import type { BuildingUnit, BuildingView } from "@/server/business/queries";

import { BuildingScene, enterViewFor, type SceneSelection, type SceneView } from "./building-scene";
import { SlabShapeDialog } from "./slab-shape-dialog";

const STATUS_STYLE: Record<UnitStatus, string> = {
  available: "bg-ok-soft text-ok",
  occupied: "bg-danger-soft text-danger",
  maintenance: "bg-warn-soft text-warn",
};

// Ayuda de abajo del 3D, según dónde estés (como el prototipo).
const HINT: Record<SceneView["level"], string> = {
  building: "Clic: ver datos · Doble clic: entrar · Arrastra un piso para reordenar",
  floor: "Clic: ver y editar · Arrastra para mover · Doble clic en un departamento: entrar · Esc: volver",
  unit: "Clic: ver y editar · Arrastra un cuarto para moverlo · Esc: volver",
};

function UnitLine({ unit, onOpen }: { unit: BuildingUnit; onOpen: () => void }) {
  const byRoom = unit.type === "apartment" && unit.rentalMode === "by_room";
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="flex min-h-11 w-full items-center gap-2 border-t py-2 text-left text-sm hover:bg-muted/50"
      >
        <span className="min-w-0 flex-1 truncate">{unit.name}</span>
        {byRoom ? (
          <span className="text-muted-foreground">{unit.rooms.length} cuartos</span>
        ) : (
          <>
            <span className={cn("rounded-full px-2 py-0.5 text-xs font-bold", STATUS_STYLE[unit.status])}>
              {STATUS_LABEL[unit.status]}
            </span>
            <b className="w-20 text-right">{formatSoles(unit.monthlyPrice) ?? "S/ —"}</b>
          </>
        )}
      </button>
    </li>
  );
}

// Modo 3D de la pantalla Edificio, con la estructura del diseño: el 3D a la izquierda y el panel a la derecha.
// Este archivo y la escena solo se descargan al elegir el modo 3D (importación diferida).
export function Building3DView({ building, toggle }: { building: BuildingView; toggle: ReactNode }) {
  const [view, setView] = useState<SceneView>({ level: "building" });
  const [selection, setSelection] = useState<SceneSelection>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [message, setMessage] = useState<string>();
  const [pending, startTransition] = useTransition();
  const { summary } = building;

  const floor = view.level === "building" ? null : building.floors.find((f) => f.id === view.floorId);
  const apartment =
    view.level === "unit" && floor ? floor.units.find((u) => u.id === view.unitId) : undefined;
  // Si lo que estabas viendo ya no existe (por ejemplo, se borró), se vuelve al edificio.
  const safeView: SceneView =
    view.level !== "building" && (!floor || (view.level === "unit" && !apartment))
      ? { level: "building" }
      : view;

  const enter = (next: SceneView) => {
    setView(next);
    setSelection(null);
  };
  const back = () => {
    if (safeView.level === "unit" && floor && !(apartment?.occupiesWholeFloor && floor.units.length === 1)) {
      enter({ level: "floor", floorId: floor.id });
    } else enter({ level: "building" });
  };

  // Esc: volver un nivel (como el prototipo), salvo que haya una ventana abierta.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !editing && view.level !== "building") back();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const run = (action: () => Promise<BuildingResult>) =>
    new Promise<void>((resolve) =>
      startTransition(async () => {
        const result = await action();
        setMessage(result.ok ? undefined : result.message);
        resolve();
      }),
    );

  const crumbs = [
    "Edificio",
    ...(floor && safeView.level !== "building" ? [floorName(floor.level)] : []),
    ...(apartment ? [apartment.name] : []),
  ];
  const selectedFloor =
    selection?.kind === "floor" ? building.floors.find((f) => f.id === selection.id) : undefined;
  const selectedUnit = selection?.kind === "unit" ? findSheetTarget(building, selection.id) : null;
  const direct = building.floors.find(
    (f) => f.units.length === 1 && f.units[0].type === "apartment" && f.units[0].occupiesWholeFloor,
  );

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        {toggle}
        <span className="rounded-full bg-primary-soft px-3 py-1.5 text-xs font-bold text-primary-text">
          {summary.floors} {summary.floors === 1 ? "piso" : "pisos"} · {summary.rentable} alquilables ·{" "}
          {summary.occupied} {summary.occupied === 1 ? "ocupado" : "ocupados"}
        </span>
        <span className="flex-1" />
        {safeView.level !== "building" ? (
          <Button type="button" variant="outline" className="h-11 gap-2" onClick={back}>
            <ArrowLeft className="size-4" aria-hidden="true" />
            Volver
          </Button>
        ) : (
          <Button
            type="button"
            className="h-11 gap-2 px-4"
            disabled={pending}
            onClick={() => run(() => addFloorAction(building.id))}
          >
            <Plus className="size-4" aria-hidden="true" />
            Agregar piso
          </Button>
        )}
      </div>
      <FormMessage message={message} />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <section
          aria-label="Edificio en 3D"
          className="relative h-[420px] overflow-hidden rounded-xl border bg-background sm:h-[540px]"
        >
          <p className="absolute top-3 left-4 z-10 text-sm text-muted-foreground">{crumbs.join(" › ")}</p>
          {building.floors.length ? (
            <BuildingScene
              building={building}
              view={safeView}
              selection={selection}
              onSelect={setSelection}
              onEnter={enter}
              onMoveFloor={(id, level) => run(() => moveFloorToAction(id, level))}
              onMoveUnit={(id, x, z) => run(() => moveUnitAction(id, x, z))}
            />
          ) : (
            <p className="p-6 pt-12 text-muted-foreground">
              Esta propiedad todavía no tiene pisos. Agrega el primero.
            </p>
          )}
          <p className="absolute bottom-3 left-4 z-10 max-w-[80%] text-sm text-muted-foreground">
            {pending ? "Guardando…" : HINT[safeView.level]}
          </p>
          <p className="sr-only">
            Para recorrer el edificio con el teclado o un lector de pantalla, usa el modo Simple.
          </p>
        </section>

        <aside className="flex flex-col gap-5 lg:sticky lg:top-24">
          {selectedUnit ? (
            // Una unidad elegida: sus datos, editar y (si es departamento) entrar.
            <section className="flex flex-col gap-3 rounded-xl border bg-card p-5 shadow-card">
              <h2 className="text-lg font-bold">{selectedUnit.unit.name}</h2>
              <p className="text-sm text-muted-foreground">
                {selectedUnit.floorLabel} ·{" "}
                {selectedUnit.unit.type === "apartment" ? "Departamento" : "Cuarto"}
                {selectedUnit.parent ? ` · dentro de ${selectedUnit.parent.name}` : ""}
              </p>
              <ul>
                <UnitLine unit={selectedUnit.unit} onOpen={() => setEditing(selectedUnit.unit.id)} />
              </ul>
              <div className="flex flex-wrap gap-2">
                <Button type="button" className="h-11 px-4" onClick={() => setEditing(selectedUnit.unit.id)}>
                  Editar
                </Button>
                {selectedUnit.unit.type === "apartment" && floor ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11"
                    onClick={() => enter({ level: "unit", floorId: floor.id, unitId: selectedUnit.unit.id })}
                  >
                    Entrar al departamento
                  </Button>
                ) : null}
              </div>
            </section>
          ) : selectedFloor ? (
            // Un piso elegido en el edificio: sus unidades, entrar y editar.
            <section className="flex flex-col gap-3 rounded-xl border bg-card p-5 shadow-card">
              <h2 className="text-lg font-bold">{floorName(selectedFloor.level)}</h2>
              <ul>
                {selectedFloor.units.map((u) => (
                  <UnitLine key={u.id} unit={u} onOpen={() => setEditing(u.id)} />
                ))}
                {!selectedFloor.units.length ? (
                  <li className="border-t py-2 text-sm text-muted-foreground">Sin unidades todavía.</li>
                ) : null}
              </ul>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  className="h-11 px-4"
                  onClick={() => enter(enterViewFor(selectedFloor))}
                >
                  {enterViewFor(selectedFloor).level === "unit" ? "Entrar al departamento" : "Entrar al piso"}
                </Button>
                <SlabShapeDialog
                  floorId={selectedFloor.id}
                  floorLabel={floorName(selectedFloor.level)}
                  outline={selectedFloor.outline}
                />
              </div>
            </section>
          ) : floor && safeView.level !== "building" ? (
            // Dentro de un piso o de un departamento: lo que hay y cómo agregar.
            <section className="flex flex-col gap-3 rounded-xl border bg-card p-5 shadow-card">
              <h2 className="text-lg font-bold">{apartment ? apartment.name : floorName(floor.level)}</h2>
              <p className="text-sm text-muted-foreground">
                {apartment
                  ? apartment.rentalMode === "by_room"
                    ? "Se alquila por cuartos: el precio está en cada cuarto."
                    : "Se alquila completo: sus cuartos solo lo describen."
                  : "Selecciona una unidad para ver o editar sus datos."}
              </p>
              <ul>
                {(apartment ? apartment.rooms : floor.units).map((u) => (
                  <UnitLine key={u.id} unit={u} onOpen={() => setSelection({ kind: "unit", id: u.id })} />
                ))}
              </ul>
              <div className="flex flex-wrap gap-2">
                {apartment ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 gap-1"
                    disabled={pending}
                    onClick={() => run(() => addRoomAction(apartment.id))}
                  >
                    <Plus className="size-4" aria-hidden="true" />
                    Cuarto
                  </Button>
                ) : (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11 gap-1"
                      disabled={pending}
                      onClick={() => run(() => addUnitAction(floor.id, "apartment"))}
                    >
                      <Plus className="size-4" aria-hidden="true" />
                      Departamento
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11 gap-1"
                      disabled={pending}
                      onClick={() => run(() => addUnitAction(floor.id, "room"))}
                    >
                      <Plus className="size-4" aria-hidden="true" />
                      Cuarto
                    </Button>
                    <SlabShapeDialog
                      floorId={floor.id}
                      floorLabel={floorName(floor.level)}
                      outline={floor.outline}
                    />
                  </>
                )}
              </div>
            </section>
          ) : (
            // Nada elegido: el resumen del edificio.
            <section className="flex flex-col gap-3 rounded-xl border bg-card p-5 shadow-card">
              <h2 className="text-lg font-bold">Edificio</h2>
              <p className="text-sm text-muted-foreground">
                Selecciona un piso para ver sus unidades. Si un piso tiene un solo departamento que ocupa todo
                el piso, el doble clic entra directo a él.
              </p>
              <ul>
                {[...building.floors].reverse().map((f) => (
                  <li key={f.id}>
                    <button
                      type="button"
                      onClick={() => setSelection({ kind: "floor", id: f.id })}
                      className="flex min-h-11 w-full justify-between gap-2 border-t py-2 text-left text-sm hover:bg-muted/50"
                    >
                      <span className="font-semibold">{floorName(f.level)}</span>
                      <span className="text-muted-foreground">
                        {f.units.length} {f.units.length === 1 ? "unidad" : "unidades"}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {direct && safeView.level === "building" ? (
            <section className="flex flex-col gap-2 rounded-xl border bg-card p-5 shadow-card">
              <h2 className="text-lg font-bold">Entrada directa</h2>
              <p className="text-sm text-muted-foreground">
                El {floorName(direct.level)} tiene un solo departamento que ocupa todo el piso: el doble clic
                entra directo a él.
              </p>
            </section>
          ) : null}
        </aside>
      </div>

      <UnitSheet
        target={findSheetTarget(building, editing)}
        onClose={() => setEditing(null)}
        onSelect={setEditing}
      />
    </>
  );
}
