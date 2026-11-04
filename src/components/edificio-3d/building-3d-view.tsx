"use client";

import { Plus } from "lucide-react";
import { useState, useTransition, type ReactNode } from "react";

import { FormMessage } from "@/components/auth/auth-field";
import { Button } from "@/components/ui/button";
import { addFloorAction } from "@/server/building/actions";
import { floorName } from "@/server/building/floors";
import type { BuildingView } from "@/server/business/queries";

import { BuildingScene } from "./building-scene";

// Modo 3D de la pantalla Edificio, con la estructura del diseño: el 3D a la izquierda y el panel a la derecha.
// Este archivo y la escena solo se descargan al elegir el modo 3D (importación diferida).
export function Building3DView({ building, toggle }: { building: BuildingView; toggle: ReactNode }) {
  const [message, setMessage] = useState<string>();
  const [pending, startTransition] = useTransition();
  const { summary } = building;
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
        <Button
          type="button"
          className="h-11 gap-2 px-4"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await addFloorAction(building.id);
              setMessage(result.ok ? undefined : result.message);
            })
          }
        >
          <Plus className="size-4" aria-hidden="true" />
          Agregar piso
        </Button>
      </div>
      <FormMessage message={message} />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <section
          aria-label="Edificio en 3D"
          className="relative h-[420px] overflow-hidden rounded-xl border bg-background sm:h-[520px]"
        >
          {building.floors.length ? (
            <BuildingScene floors={building.floors} />
          ) : (
            <p className="p-6 text-muted-foreground">Esta propiedad todavía no tiene pisos.</p>
          )}
          <p className="sr-only">
            Edificio de {summary.floors} pisos. Para ver y editar sus unidades con el teclado o un lector de
            pantalla, usa el modo Simple.
          </p>
        </section>

        <aside className="flex flex-col gap-5 lg:sticky lg:top-24">
          <section className="flex flex-col gap-3 rounded-xl border bg-card p-5 shadow-card">
            <h2 className="text-lg font-bold">Edificio</h2>
            <p className="text-sm text-muted-foreground">Selecciona un piso para ver sus unidades.</p>
            <ul className="flex flex-col">
              {[...building.floors].reverse().map((f) => (
                <li key={f.id} className="flex justify-between gap-2 border-t py-2.5 text-sm">
                  <span className="font-semibold">{floorName(f.level)}</span>
                  <span className="text-muted-foreground">
                    {f.units.length} {f.units.length === 1 ? "unidad" : "unidades"}
                  </span>
                </li>
              ))}
            </ul>
          </section>
          {direct ? (
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
    </>
  );
}
