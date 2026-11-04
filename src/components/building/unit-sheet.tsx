"use client";

import { Plus } from "lucide-react";
import { useState, useTransition } from "react";
import { FormProvider, useForm, useWatch } from "react-hook-form";

import { FormMessage } from "@/components/auth/auth-field";
import { ConfirmButton } from "@/components/confirm-button";
import { FieldError, TextField } from "@/components/onboarding/form-field";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { formatSoles } from "@/lib/format";
import { cn } from "@/lib/utils";
import { addRoomAction, deleteUnitAction, updateUnitAction } from "@/server/building/actions";
import { SPACE_TYPE_LABEL, SPACE_TYPES, type UnitEditInput } from "@/server/building/schemas";
import type { BuildingUnit } from "@/server/business/queries";

type Form = {
  name: string;
  monthlyPrice: string;
  areaM2: string;
  bathroom: "" | "private" | "shared";
  furnished: boolean;
  spaceType: "" | (typeof SPACE_TYPES)[number];
  rentalMode: "whole" | "by_room";
  occupiesWholeFloor: boolean;
};

const toForm = (u: BuildingUnit): Form => ({
  name: u.name,
  monthlyPrice: u.monthlyPrice ? String(Number(u.monthlyPrice)) : "",
  areaM2: u.areaM2 ? String(Number(u.areaM2)) : "",
  bathroom: u.bathroom ?? "",
  furnished: u.furnished,
  spaceType: u.spaceType ?? "",
  rentalMode: u.rentalMode ?? "whole",
  occupiesWholeFloor: u.occupiesWholeFloor,
});

const selectClass = "h-11 rounded-lg border border-input bg-transparent px-2.5 text-base md:text-sm";

export type SheetTarget = {
  unit: BuildingUnit;
  parent: BuildingUnit | null;
  floorLabel: string;
  // ¿Es la única unidad suelta del piso? (para "ocupa todo el piso")
  onlyUnit: boolean;
};

function UnitForm({
  target,
  onSelect,
  onDone,
}: {
  target: SheetTarget;
  onSelect: (id: string) => void;
  onDone: () => void;
}) {
  const { unit, parent } = target;
  const methods = useForm<Form>({ defaultValues: toForm(unit) });
  const { register, setValue, setError, reset, handleSubmit, formState } = methods;
  const mode = useWatch({ control: methods.control, name: "rentalMode" });
  const whole = useWatch({ control: methods.control, name: "occupiesWholeFloor" });
  const [message, setMessage] = useState<{ text: string; ok: boolean }>();
  const [pending, startTransition] = useTransition();
  const isApartment = unit.type === "apartment";

  // El precio vive en lo que se alquila: cuarto suelto, departamento completo o cuarto de un departamento por cuartos.
  const priceNote = isApartment
    ? mode === "by_room"
      ? "Se alquila por cuartos: el precio va en cada cuarto."
      : null
    : parent && parent.rentalMode !== "by_room"
      ? "Incluido en el departamento: el precio va en el departamento."
      : null;

  const save = handleSubmit((values) =>
    startTransition(async () => {
      const input: UnitEditInput = {
        name: values.name,
        monthlyPrice: priceNote ? "" : values.monthlyPrice,
        areaM2: values.areaM2,
        bathroom: values.bathroom,
        furnished: values.furnished,
        spaceType: values.spaceType,
        ...(isApartment
          ? { rentalMode: values.rentalMode, occupiesWholeFloor: values.occupiesWholeFloor }
          : {}),
      };
      const result = await updateUnitAction(unit.id, input);
      if (result.ok) {
        reset(values);
        setMessage({ text: "Cambios guardados.", ok: true });
        return;
      }
      setMessage({ text: result.message, ok: false });
      for (const [path, msg] of Object.entries(result.fieldErrors ?? {})) {
        setError(path as keyof Form, { type: "manual", message: msg });
      }
    }),
  );

  const remove = () =>
    startTransition(async () => {
      const result = await deleteUnitAction(unit.id);
      if (result.ok) onDone();
      else setMessage({ text: result.message, ok: false });
    });

  const addRoom = () =>
    startTransition(async () => {
      const result = await addRoomAction(unit.id);
      setMessage(result.ok ? { text: "Cuarto agregado.", ok: true } : { text: result.message, ok: false });
    });

  return (
    <FormProvider {...methods}>
      <form onSubmit={save} noValidate className="flex flex-1 flex-col gap-5 overflow-y-auto px-4 pb-4">
        <TextField name="name" label="Nombre" />
        {priceNote ? (
          <p className="rounded-lg bg-muted/60 px-3 py-2 text-sm text-muted-foreground">{priceNote}</p>
        ) : (
          <TextField
            name="monthlyPrice"
            label="Precio mensual"
            prefix="S/"
            inputMode="decimal"
            placeholder="0"
          />
        )}

        {isApartment ? (
          <div className="flex flex-col gap-3 rounded-xl border p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold">Se alquila</span>
              <div
                role="radiogroup"
                aria-label="Cómo se alquila"
                className="flex rounded-lg border bg-card p-0.5"
              >
                {(
                  [
                    ["whole", "Completo"],
                    ["by_room", "Por cuartos"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={mode === value}
                    onClick={() => setValue("rentalMode", value, { shouldDirty: true })}
                    className={cn(
                      "min-h-10 rounded-md px-3 text-sm font-semibold transition-colors duration-200",
                      mode === value
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <label
              className={cn("flex min-h-11 items-center gap-3 text-sm", !target.onlyUnit && "opacity-60")}
            >
              <input
                type="checkbox"
                role="switch"
                className="size-5 accent-primary"
                checked={whole}
                disabled={!target.onlyUnit}
                onChange={(e) => setValue("occupiesWholeFloor", e.target.checked, { shouldDirty: true })}
              />
              <span>
                <span className="font-semibold">Ocupa todo el piso</span>
                <span className="block text-muted-foreground">
                  {target.onlyUnit
                    ? "En el 3D se entra directo al departamento."
                    : "Solo si es la única unidad del piso."}
                </span>
              </span>
            </label>
            <FieldError name="occupiesWholeFloor" />
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField name="areaM2" label="Área en m² (opcional)" inputMode="decimal" />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="spaceType">Tipo de ambiente</Label>
            <select id="spaceType" className={selectClass} {...register("spaceType")}>
              <option value="">Sin indicar</option>
              {SPACE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {SPACE_TYPE_LABEL[t]}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bathroom">Baño</Label>
            <select id="bathroom" className={selectClass} {...register("bathroom")}>
              <option value="">Sin indicar</option>
              <option value="private">Propio</option>
              <option value="shared">Compartido</option>
            </select>
          </div>
          <label className="flex min-h-11 items-center gap-3 self-end text-sm">
            <input type="checkbox" className="size-5 accent-primary" {...register("furnished")} />
            Amoblado
          </label>
        </div>

        {isApartment ? (
          <section className="flex flex-col gap-2" aria-label="Cuartos del departamento">
            <h3 className="text-sm font-semibold">
              {unit.rentalMode === "by_room" ? "Cuartos que se alquilan" : "Cuartos del departamento"}
            </h3>
            {unit.rooms.length ? (
              <ul className="flex flex-col divide-y rounded-lg border">
                {unit.rooms.map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => onSelect(r.id)}
                      className="flex min-h-11 w-full items-center gap-3 px-3 text-left text-sm hover:bg-muted"
                    >
                      <span className="flex-1 font-semibold">{r.name}</span>
                      <span className="text-muted-foreground">
                        {unit.rentalMode === "by_room" ? (formatSoles(r.monthlyPrice) ?? "S/ —") : "Incluido"}
                      </span>
                      <span className="text-link">Editar</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Todavía no tiene cuartos.</p>
            )}
            <div>
              <Button
                type="button"
                variant="outline"
                className="h-11 gap-2"
                onClick={addRoom}
                disabled={pending}
              >
                <Plus className="size-4" aria-hidden="true" />
                Agregar cuarto
              </Button>
            </div>
          </section>
        ) : null}

        {message ? (
          message.ok ? (
            <p role="status" className="rounded-lg bg-ok-soft px-3 py-2 text-sm font-semibold text-ok">
              {message.text}
            </p>
          ) : (
            <FormMessage message={message.text} />
          )
        ) : null}

        <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t pt-4">
          <ConfirmButton
            trigger={
              <Button type="button" variant="destructive" className="h-11" disabled={pending}>
                Quitar
              </Button>
            }
            title={`¿Quitar ${unit.name}?`}
            description={
              isApartment && unit.rooms.length
                ? `Se quitan también sus ${unit.rooms.length} cuartos. No se puede deshacer.`
                : "Se quita del edificio. No se puede deshacer."
            }
            confirmLabel="Quitar"
            onConfirm={remove}
          />
          <Button type="submit" className="h-11 px-5" disabled={pending || !formState.isDirty}>
            {pending ? "Guardando…" : "Guardar"}
          </Button>
        </div>
      </form>
    </FormProvider>
  );
}

// Panel lateral para editar una unidad (decisión del dueño). En móvil ocupa toda la pantalla.
export function UnitSheet({
  target,
  onClose,
  onSelect,
}: {
  target: SheetTarget | null;
  onClose: () => void;
  onSelect: (id: string) => void;
}) {
  return (
    <Sheet open={target !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="flex w-full flex-col gap-4 sm:max-w-md">
        {target ? (
          <>
            <SheetHeader>
              <SheetTitle>Editar {target.unit.name}</SheetTitle>
              <SheetDescription>
                {target.floorLabel} · {target.unit.type === "apartment" ? "Departamento" : "Cuarto"}
                {target.parent ? ` · dentro de ${target.parent.name}` : ""}
              </SheetDescription>
            </SheetHeader>
            {/* key: al cambiar de unidad, el formulario empieza con los datos de la nueva. */}
            <UnitForm key={target.unit.id} target={target} onSelect={onSelect} onDone={onClose} />
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
