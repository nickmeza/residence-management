"use client";

import { ArrowLeft } from "lucide-react";
import { useMemo, useState } from "react";

import { BuildingScene, type SceneSelection, type SceneView } from "@/components/edificio-3d/building-scene";
import { findSheetTarget } from "@/components/building/sheet-target";
import { Button } from "@/components/ui/button";
import { formatSoles } from "@/lib/format";
import { floorName } from "@/server/building/floors";
import type { SetupForm } from "@/server/onboarding/form";

import { previewBuilding } from "./preview-building";

// Vista previa 3D del paso "Arma tu edificio": dibuja lo que se va armando, sin guardar nada.
// Solo para mirar: clic para ver datos, doble clic para entrar, Volver para salir. Sin arrastre.
// Este archivo (y three.js) solo se descarga al elegir el modo 3D.
export function BuildingPreview3D({ property }: { property: SetupForm["property"] }) {
  const building = useMemo(() => previewBuilding(property), [property]);
  const [view, setView] = useState<SceneView>({ level: "building" });
  const [selection, setSelection] = useState<SceneSelection>(null);

  const floor = view.level === "building" ? undefined : building.floors.find((f) => f.id === view.floorId);
  const apartment = view.level === "unit" ? floor?.units.find((u) => u.id === view.unitId) : undefined;
  // Si se quitó el piso o el departamento que se estaba viendo, se vuelve al edificio.
  const safeView: SceneView =
    view.level !== "building" && (!floor || (view.level === "unit" && !apartment))
      ? { level: "building" }
      : view;
  const enter = (next: SceneView) => {
    setView(next);
    setSelection(null);
  };
  const selectedFloor =
    selection?.kind === "floor" ? building.floors.find((f) => f.id === selection.id) : undefined;
  const selectedUnit = selection?.kind === "unit" ? findSheetTarget(building, selection.id) : null;
  const crumbs = [
    "Edificio",
    ...(floor && safeView.level !== "building" ? [floorName(floor.level)] : []),
    ...(apartment ? [apartment.name] : []),
  ];

  return (
    <div className="flex flex-col gap-2">
      <div className="relative h-72 overflow-hidden rounded-lg border bg-background sm:h-80">
        <p className="absolute top-2 left-3 z-10 text-xs text-muted-foreground">{crumbs.join(" › ")}</p>
        {safeView.level !== "building" ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="absolute top-2 right-2 z-10 h-9 gap-1"
            onClick={() =>
              safeView.level === "unit" && floor && floor.units.length > 1
                ? enter({ level: "floor", floorId: floor.id })
                : enter({ level: "building" })
            }
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Volver
          </Button>
        ) : null}
        <BuildingScene
          building={building}
          view={safeView}
          selection={selection}
          onSelect={setSelection}
          onEnter={enter}
        />
      </div>
      <p role="status" className="min-h-5 text-sm">
        {selectedUnit ? (
          <>
            <b>{selectedUnit.unit.name}</b> ·{" "}
            {selectedUnit.parent?.rentalMode === "whole" ||
            (selectedUnit.unit.type === "apartment" && selectedUnit.unit.rentalMode === "by_room")
              ? selectedUnit.parent
                ? "Incluido"
                : "Precio en cada cuarto"
              : (formatSoles(selectedUnit.unit.monthlyPrice) ?? "Sin precio")}
          </>
        ) : selectedFloor ? (
          <>
            <b>{floorName(selectedFloor.level)}</b> · {selectedFloor.units.length}{" "}
            {selectedFloor.units.length === 1 ? "unidad" : "unidades"}
          </>
        ) : (
          <span className="text-muted-foreground">Clic: ver datos · Doble clic: entrar</span>
        )}
      </p>
    </div>
  );
}
