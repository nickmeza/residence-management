"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useOptimistic, useRef, useState, useTransition } from "react";

import {
  hrefForView,
  parentHref,
  sceneFor,
  unitHref,
  type BuildingRoute,
} from "@/components/building/building-route";
import { FormMessage } from "@/components/auth/auth-field";
import { Button } from "@/components/ui/button";
import { moveFloorToAction, moveUnitAction, type BuildingResult } from "@/server/building/actions";
import { floorName } from "@/server/building/floors";
import type { BuildingView } from "@/server/business/queries";

import { applyMove, type PendingMove } from "./apply-move";
import { BuildingScene, enterViewFor, type SceneSelection, type SceneView } from "./building-scene";

// Ayuda de abajo del 3D, según dónde estés (como el prototipo).
const HINT: Record<SceneView["level"], string> = {
  building: "Clic: elegir un piso · Doble clic: entrar · Arrastra un piso para reordenar",
  floor: "Clic: abrir la unidad · Arrastra para mover · Doble clic en un departamento: entrar · Esc: volver",
  unit: "Clic: abrir el cuarto · Arrastra un cuarto para moverlo · Esc: volver",
};

// Modo 3D del edificio. Lo que se ve sale de la dirección (route): entrar a un piso o tocar una unidad lleva a su
// página, y la página se muestra al lado. Vive en el marco del edificio (layout), así que al cambiar de página
// el 3D no se vuelve a cargar. Este archivo y la escena solo se descargan al elegir el modo 3D.
export function Building3DView({ building: saved, route }: { building: BuildingView; route: BuildingRoute }) {
  const router = useRouter();
  // Lo que se muestra: los datos guardados más los movimientos que todavía se están guardando.
  // Si el servidor rechaza uno, ese movimiento desaparece solo y la unidad vuelve a su lugar.
  const [building, addMove] = useOptimistic(saved, applyMove);
  const [, startMove] = useTransition();
  // Cola: los movimientos se guardan uno detrás de otro, en el orden en que se hicieron.
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const [saving, setSaving] = useState(0);
  // Elegir un piso (un clic en el edificio) no cambia de página: solo lo marca.
  const [floorPick, setFloorPick] = useState<string | null>(null);
  const [message, setMessage] = useState<string>();

  const { view, selectedUnitId } = sceneFor(building, route);
  const pickedFloor =
    view.level === "building" && floorPick ? building.floors.find((f) => f.id === floorPick) : undefined;
  const selection: SceneSelection = selectedUnitId
    ? { kind: "unit", id: selectedUnitId }
    : pickedFloor
      ? { kind: "floor", id: pickedFloor.id }
      : null;
  const back = parentHref(building, route);

  const select = (next: SceneSelection) => {
    if (next?.kind === "unit") router.push(unitHref(building.id, next.id));
    else setFloorPick(next?.id ?? null);
  };
  const enter = (next: SceneView) => {
    setFloorPick(null);
    router.push(hrefForView(building, next));
  };

  // Esc: volver un nivel (como el prototipo), salvo que haya una ventana abierta o estés escribiendo.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && e.target.closest("input, textarea, select, [role=dialog]");
      if (e.key === "Escape" && back && !typing) router.push(back);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [back, router]);

  // Guarda un movimiento en segundo plano: se ve al instante y se envía en orden. No bloquea nada.
  const saveMove = (move: PendingMove, action: () => Promise<BuildingResult>) =>
    startMove(async () => {
      addMove(move);
      setSaving((n) => n + 1);
      const result = queue.current.then(action);
      queue.current = result.catch(() => undefined);
      const outcome = await result.catch(() => ({
        ok: false as const,
        message: "No pudimos guardar el cambio. Vuelve a intentarlo.",
      }));
      setSaving((n) => n - 1);
      if (!outcome.ok) setMessage(outcome.message);
    });

  return (
    <div className="flex flex-col gap-3">
      <section
        aria-label="Edificio en 3D"
        className="relative h-[360px] overflow-hidden rounded-xl border bg-background sm:h-[540px]"
      >
        {back ? (
          <Button
            type="button"
            variant="outline"
            className="absolute top-3 left-3 z-10 h-11 gap-2 bg-card"
            onClick={() => router.push(back)}
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Volver
          </Button>
        ) : null}
        {saving > 0 ? (
          <p
            role="status"
            className="absolute top-3 right-4 z-10 rounded-full bg-card px-3 py-1 text-xs font-semibold text-muted-foreground shadow-card"
          >
            Guardando {saving === 1 ? "1 cambio" : `${saving} cambios`}…
          </p>
        ) : null}
        {pickedFloor ? (
          <div className="absolute top-3 left-3 z-10 flex items-center gap-3 rounded-xl border bg-card py-1.5 pr-1.5 pl-4 shadow-card">
            <b className="text-sm">{floorName(pickedFloor.level)}</b>
            <span className="text-sm text-muted-foreground">
              {pickedFloor.units.length} {pickedFloor.units.length === 1 ? "unidad" : "unidades"}
            </span>
            <Button type="button" className="h-9 px-3" onClick={() => enter(enterViewFor(pickedFloor))}>
              Entrar
            </Button>
          </div>
        ) : null}
        {building.floors.length ? (
          <BuildingScene
            building={building}
            view={view}
            selection={selection}
            onSelect={select}
            onEnter={enter}
            onMoveFloor={(id, level) =>
              saveMove({ type: "floor", id, level }, () => moveFloorToAction(id, level))
            }
            onMoveUnit={(id, x, z) => saveMove({ type: "unit", id, x, z }, () => moveUnitAction(id, x, z))}
          />
        ) : (
          <p className="p-6 pt-12 text-muted-foreground">
            Esta propiedad todavía no tiene pisos. Agrega el primero.
          </p>
        )}
        <p className="absolute bottom-3 left-4 z-10 max-w-[80%] text-sm text-muted-foreground">
          {HINT[view.level]}
        </p>
        <p className="sr-only">
          Para recorrer el edificio con el teclado o un lector de pantalla, usa el modo Simple.
        </p>
      </section>
      <FormMessage message={message} />
    </div>
  );
}
