"use client";

import { ArrowDown, ArrowUp, ChevronRight, Plus } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";

import { FormMessage } from "@/components/auth/auth-field";
import { ConfirmButton } from "@/components/confirm-button";
import { Button } from "@/components/ui/button";
import {
  addFloorAction,
  deleteFloorAction,
  moveFloorAction,
  type BuildingResult,
} from "@/server/building/actions";
import { floorName } from "@/server/building/floors";
import type { BuildingView } from "@/server/business/queries";

import { floorHref } from "./building-route";
import { rentableUnits, wholeFloorApartment } from "./floor-units";

// Modo simple de la pantalla Edificio: una tarjeta por piso con un resumen corto. Al tocarla se entra a la
// página del piso. En 3D se ve al lado del edificio (el interruptor está en el marco, BuildingScreen).
export function BuildingEditor({ building }: { building: BuildingView }) {
  const [message, setMessage] = useState<string>();
  const [pending, startTransition] = useTransition();
  const { summary } = building;

  const act = (action: () => Promise<BuildingResult>) =>
    startTransition(async () => {
      const result = await action();
      setMessage(result.ok ? undefined : result.message);
    });

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
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
        <ul className="flex flex-col gap-3">
          {building.floors.map((floor) => {
            const whole = wholeFloorApartment(floor.units);
            const rentable = rentableUnits(floor.units);
            const free = rentable.filter((u) => u.status === "available").length;
            const isTop = floor.level === building.floors.length;
            const isBottom = floor.level === 1;
            return (
              <li key={floor.id} className="flex items-center gap-2 rounded-xl border bg-card p-2 shadow-card">
                <Link
                  href={floorHref(building.id, floor.id)}
                  className="flex min-h-14 min-w-0 flex-1 items-center gap-3 rounded-lg px-3 py-2 transition-colors duration-200 hover:bg-muted/60"
                >
                  <span className="min-w-0 flex-1">
                    <b className="block truncate">
                      {floorName(floor.level)}
                      {whole ? ` · ${whole.name}` : ""}
                    </b>
                    <span className="text-sm text-muted-foreground">
                      {floor.units.length === 0
                        ? "Sin unidades"
                        : whole
                          ? "Ocupa todo el piso"
                          : `${rentable.length} ${rentable.length === 1 ? "alquilable" : "alquilables"} · ${free} ${free === 1 ? "libre" : "libres"}`}
                    </span>
                  </span>
                  <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                </Link>
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
                    <Button type="button" variant="ghost" className="hidden h-11 sm:inline-flex" disabled={pending}>
                      Quitar
                    </Button>
                  }
                  title={`¿Quitar ${floorName(floor.level)}?`}
                  description="Se quitan también todas sus unidades y los pisos de arriba bajan un nivel. No se puede deshacer."
                  confirmLabel="Quitar piso"
                  onConfirm={() => act(() => deleteFloorAction(floor.id))}
                />
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
