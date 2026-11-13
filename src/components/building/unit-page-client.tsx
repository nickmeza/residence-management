"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { FormMessage } from "@/components/auth/auth-field";
import { Button } from "@/components/ui/button";
import { addRoomAction, addUnitAction, type BuildingResult } from "@/server/building/actions";

import { UnitForm, type SheetTarget } from "./unit-sheet";

// Partes interactivas de las páginas de piso y unidad. Los datos llegan del servidor; al guardar, la acción
// vuelve a pedir la página y se ve lo nuevo.

// Pestaña "Datos": el mismo formulario del panel lateral. Al quitar la unidad se vuelve a donde estaba.
export function UnitDataTab({ target, backHref }: { target: SheetTarget; backHref: string }) {
  const router = useRouter();
  return (
    <UnitForm
      key={target.unit.id}
      target={target}
      inPage
      onSelect={() => {}}
      onDone={() => router.push(backHref)}
    />
  );
}

function useAction() {
  const [message, setMessage] = useState<string>();
  const [pending, startTransition] = useTransition();
  const run = (action: () => Promise<BuildingResult>) =>
    startTransition(async () => {
      const result = await action();
      setMessage(result.ok ? undefined : result.message);
    });
  return { message, pending, run };
}

export function AddUnitButtons({ floorId }: { floorId: string }) {
  const { message, pending, run } = useAction();
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          className="h-11 gap-1"
          disabled={pending}
          onClick={() => run(() => addUnitAction(floorId, "room"))}
        >
          <Plus className="size-4" aria-hidden="true" />
          Agregar cuarto
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-11 gap-1"
          disabled={pending}
          onClick={() => run(() => addUnitAction(floorId, "apartment"))}
        >
          <Plus className="size-4" aria-hidden="true" />
          Agregar departamento
        </Button>
      </div>
      {pending ? (
        <p role="status" className="text-sm text-muted-foreground">
          Guardando…
        </p>
      ) : null}
      <FormMessage message={message} />
    </div>
  );
}

export function AddRoomButton({ apartmentId }: { apartmentId: string }) {
  const { message, pending, run } = useAction();
  return (
    <div className="flex flex-col gap-2">
      <div>
        <Button
          type="button"
          variant="outline"
          className="h-11 gap-1"
          disabled={pending}
          onClick={() => run(() => addRoomAction(apartmentId))}
        >
          <Plus className="size-4" aria-hidden="true" />
          Agregar cuarto
        </Button>
      </div>
      {pending ? (
        <p role="status" className="text-sm text-muted-foreground">
          Guardando…
        </p>
      ) : null}
      <FormMessage message={message} />
    </div>
  );
}
