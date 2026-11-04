"use client";

import { ChevronRight, Info, X } from "lucide-react";
import { useFieldArray, useFormContext, useWatch } from "react-hook-form";

import { ConfirmButton } from "@/components/confirm-button";
import { Button } from "@/components/ui/button";
import { formatSoles } from "@/lib/format";
import { cn } from "@/lib/utils";
import { floorName } from "@/server/building/floors";
import { formSummary, newRoom, newUnit, type SetupForm, type UnitForm } from "@/server/onboarding/form";

import { FieldError, FormSection, TextField } from "./form-field";

type UnitPath = `property.floors.${number}.units.${number}`;

const TYPE_LABEL = { apartment: "Departamento", room: "Cuarto" } as const;

function RemoveButton({
  what,
  description,
  onConfirm,
}: {
  what: string;
  description: string;
  onConfirm: () => void;
}) {
  return (
    <ConfirmButton
      trigger={
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-11 shrink-0"
          aria-label={`Quitar ${what}`}
        >
          <X className="size-4" aria-hidden="true" />
        </Button>
      }
      title={`¿Quitar ${what}?`}
      description={description}
      confirmLabel="Quitar"
      onConfirm={onConfirm}
    />
  );
}

// Fila compacta del prototipo: tipo · nombre · S/ precio (o "Precio en cada cuarto") · quitar.
function UnitLine({
  path,
  type,
  priceNote,
  indent,
  removable,
  onRemove,
}: {
  path: string;
  type: UnitForm["type"];
  priceNote?: string;
  indent?: boolean;
  removable?: boolean;
  onRemove: () => void;
}) {
  const name = useWatch({ name: `${path}.name` }) as string;
  return (
    <div className={cn("flex flex-wrap items-start gap-2", indent && "border-l-2 border-primary/30 pl-3")}>
      <span className="w-28 shrink-0 pt-3 text-sm font-semibold">{TYPE_LABEL[type]}</span>
      <TextField
        name={`${path}.name`}
        label={`Nombre del ${TYPE_LABEL[type].toLowerCase()}`}
        hideLabel
        className="min-w-36 flex-1"
      />
      {priceNote ? (
        <span className="w-40 pt-3 text-sm text-muted-foreground">{priceNote}</span>
      ) : (
        <TextField
          name={`${path}.monthlyPrice`}
          label={`Precio mensual de ${name || "la unidad"}`}
          hideLabel
          prefix="S/"
          inputMode="decimal"
          placeholder="0"
          className="w-40"
        />
      )}
      {removable ? (
        <RemoveButton
          what={name || "esta unidad"}
          description="Se quita de lo que estás armando."
          onConfirm={onRemove}
        />
      ) : (
        <span className="w-11" aria-hidden="true" />
      )}
    </div>
  );
}

// Un departamento: su fila, "Ocupa todo el piso", "Se alquila: Completo / Por cuartos" y sus cuartos.
function ApartmentBlock({
  path,
  onlyUnit,
  removable,
  onRemove,
}: {
  path: UnitPath;
  onlyUnit: boolean;
  removable: boolean;
  onRemove: () => void;
}) {
  const { control, setValue, getValues } = useFormContext<SetupForm>();
  const unit = useWatch<SetupForm, UnitPath>({ name: path }) as UnitForm;
  const rooms = useFieldArray({ control, name: `${path}.rooms`, keyName: "_id" });
  const byRoom = unit.rentalMode === "by_room";

  const setMode = (mode: UnitForm["rentalMode"]) => {
    setValue(`${path}.rentalMode`, mode, { shouldDirty: true });
    // El precio pasa del departamento a sus cuartos (o al revés): se limpia el que ya no aplica.
    if (mode === "by_room") setValue(`${path}.monthlyPrice`, "");
    else getValues(`${path}.rooms`).forEach((_, j) => setValue(`${path}.rooms.${j}.monthlyPrice`, ""));
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl bg-muted/40 p-3">
      <UnitLine
        path={path}
        type="apartment"
        priceNote={byRoom ? "Precio en cada cuarto" : undefined}
        removable={removable}
        onRemove={onRemove}
      />
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 sm:pl-30">
        <label
          className={cn("flex min-h-11 items-center gap-2 text-sm font-semibold", !onlyUnit && "opacity-60")}
        >
          <input
            type="checkbox"
            role="switch"
            className="size-5 accent-primary"
            checked={unit.occupiesWholeFloor}
            disabled={!onlyUnit}
            onChange={(e) => setValue(`${path}.occupiesWholeFloor`, e.target.checked, { shouldDirty: true })}
          />
          Ocupa todo el piso
        </label>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Se alquila</span>
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
            ).map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                role="radio"
                aria-checked={unit.rentalMode === mode}
                onClick={() => setMode(mode)}
                className={cn(
                  "min-h-10 rounded-md px-3 text-sm font-semibold transition-colors duration-200",
                  unit.rentalMode === mode
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
      {unit.occupiesWholeFloor ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground sm:pl-30">
          <Info className="size-4 shrink-0" aria-hidden="true" />
          Este piso funciona como un solo departamento: en el 3D se entra directo a él.
        </p>
      ) : null}
      <FieldError name={`${path}.occupiesWholeFloor`} />

      {rooms.fields.map((r, j) => (
        <UnitLine
          key={r._id}
          path={`${path}.rooms.${j}`}
          type="room"
          indent
          priceNote={byRoom ? undefined : "Incluido"}
          removable
          onRemove={() => rooms.remove(j)}
        />
      ))}
      <FieldError name={`${path}.rooms`} />
      <div className="sm:pl-30">
        <Button
          type="button"
          variant="link"
          className="h-11 px-0 text-link"
          onClick={() => rooms.append(newRoom(getValues(`${path}.name`), rooms.fields.length))}
        >
          + {byRoom ? "Cuarto que se alquila" : "Dormitorio del departamento"}
        </Button>
      </div>
    </div>
  );
}

function FloorBlock({
  index,
  canRemove,
  canAddUnits,
  onRemove,
}: {
  index: number;
  canRemove: boolean;
  canAddUnits: boolean;
  onRemove: () => void;
}) {
  const { control, setValue } = useFormContext<SetupForm>();
  const units = useFieldArray({ control, name: `property.floors.${index}.units`, keyName: "_id" });
  const values = useWatch<SetupForm, `property.floors.${number}.units`>({
    name: `property.floors.${index}.units`,
  });
  const level = index + 1;
  // Con otra unidad en el piso, "ocupa todo el piso" deja de ser posible: se desmarca.
  const add = (type: UnitForm["type"]) => {
    units.fields.forEach((_, i) => setValue(`property.floors.${index}.units.${i}.occupiesWholeFloor`, false));
    units.append(newUnit(type, level, units.fields.length));
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-bold">
          {floorName(level)}{" "}
          <span className="text-sm font-normal text-muted-foreground">
            {units.fields.length} {units.fields.length === 1 ? "unidad" : "unidades"}
          </span>
        </h3>
        {canRemove ? (
          <ConfirmButton
            trigger={
              <Button type="button" variant="ghost" className="h-11">
                Quitar piso
              </Button>
            }
            title={`¿Quitar ${floorName(level)}?`}
            description="Se quitan también todas sus unidades. Los pisos de arriba bajan un nivel."
            confirmLabel="Quitar piso"
            onConfirm={onRemove}
          />
        ) : null}
      </div>
      {units.fields.map((u, i) =>
        values?.[i]?.type === "apartment" ? (
          <ApartmentBlock
            key={u._id}
            path={`property.floors.${index}.units.${i}`}
            onlyUnit={units.fields.length === 1}
            removable={units.fields.length > 1}
            onRemove={() => units.remove(i)}
          />
        ) : (
          <UnitLine
            key={u._id}
            path={`property.floors.${index}.units.${i}`}
            type="room"
            removable={units.fields.length > 1}
            onRemove={() => units.remove(i)}
          />
        ),
      )}
      <FieldError name={`property.floors.${index}.units`} />
      {canAddUnits ? (
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" className="h-11" onClick={() => add("apartment")}>
            + Departamento
          </Button>
          <Button type="button" variant="outline" className="h-11" onClick={() => add("room")}>
            + Cuarto
          </Button>
        </div>
      ) : null}
    </div>
  );
}

// Fila de la vista previa: nombre, estado (con texto) y precio.
function PreviewRow({
  name,
  price,
  note,
  nested,
}: {
  name: string;
  price?: string | null;
  note?: string;
  nested?: boolean;
}) {
  return (
    <li className={cn("flex items-center gap-2 py-2 text-sm", nested && "pl-4")}>
      <span className="min-w-0 flex-1 truncate">{name || "Sin nombre"}</span>
      {note ? (
        <span className="text-muted-foreground">{note}</span>
      ) : (
        <span className="rounded-full bg-ok-soft px-2 py-0.5 text-xs font-bold text-ok">Disponible</span>
      )}
      {price !== undefined ? <span className="w-20 text-right font-semibold">{price ?? "S/ —"}</span> : null}
    </li>
  );
}

// Columna derecha: "Resumen del edificio" con cifras y la vista previa en acordeones.
function BuildingPreview() {
  const floors = useWatch<SetupForm, "property.floors">({ name: "property.floors" });
  const summary = formSummary(floors);
  return (
    <aside
      className="flex flex-col gap-4 rounded-xl border bg-card p-4 shadow-card sm:p-6 lg:sticky lg:top-6"
      aria-label="Resumen del edificio"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-bold">Resumen del edificio</h2>
        <span className="rounded-full bg-chip px-2.5 py-1 text-xs font-bold text-chip-foreground">
          {summary.floors} {summary.floors === 1 ? "piso" : "pisos"}
        </span>
      </div>
      <dl className="grid grid-cols-3 gap-2 text-center">
        {(
          [
            ["Pisos", summary.floors],
            ["Departamentos", summary.apartments],
            ["Alquilables", summary.rentable],
          ] as const
        ).map(([label, value]) => (
          <div key={label} className="rounded-lg bg-muted/50 p-3">
            <dd className="text-2xl font-bold">{value}</dd>
            <dt className="text-xs text-muted-foreground">{label}</dt>
          </div>
        ))}
      </dl>
      <div className="flex flex-col gap-2">
        {floors.map((floor, f) => {
          const whole =
            floor.units.length === 1 &&
            floor.units[0].type === "apartment" &&
            floor.units[0].occupiesWholeFloor;
          const first = floor.units[0];
          return (
            <details key={f} open className="group rounded-lg border">
              <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-3 text-sm font-semibold">
                <ChevronRight
                  className="size-4 transition-transform duration-200 group-open:rotate-90"
                  aria-hidden="true"
                />
                <span className="flex-1">
                  {floorName(f + 1)}
                  {whole ? ` · ${first.name}` : ""}
                </span>
                {whole ? (
                  <>
                    <span className="rounded-full bg-primary-soft px-2 py-0.5 text-xs text-primary-text">
                      Ocupa todo el piso
                    </span>
                    <span>{formatSoles(first.monthlyPrice) ?? "S/ —"}</span>
                  </>
                ) : (
                  <span className="font-normal text-muted-foreground">
                    {floor.units.length} {floor.units.length === 1 ? "unidad" : "unidades"}
                  </span>
                )}
              </summary>
              <ul className="divide-y border-t px-3">
                {floor.units.map((u) =>
                  u.type === "room" ? (
                    <PreviewRow key={u.key} name={u.name} price={formatSoles(u.monthlyPrice)} />
                  ) : (
                    <li key={u.key} className="py-1">
                      {!whole ? (
                        <ul>
                          <PreviewRow
                            name={u.name}
                            note={u.rentalMode === "by_room" ? "Por cuartos" : undefined}
                            price={u.rentalMode === "by_room" ? undefined : formatSoles(u.monthlyPrice)}
                          />
                        </ul>
                      ) : null}
                      <ul>
                        {u.rooms.map((r) => (
                          <PreviewRow
                            key={r.key}
                            nested={!whole}
                            name={r.name}
                            note={u.rentalMode === "whole" ? "Incluido" : undefined}
                            price={u.rentalMode === "by_room" ? formatSoles(r.monthlyPrice) : undefined}
                          />
                        ))}
                      </ul>
                    </li>
                  ),
                )}
              </ul>
            </details>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        Un piso que ocupa un solo departamento se muestra como una sola fila, sin un nivel extra.
      </p>
    </aside>
  );
}

export function StepBuilding() {
  const { control } = useFormContext<SetupForm>();
  const type = useWatch<SetupForm, "property.type">({ name: "property.type" });
  const floors = useFieldArray({ control, name: "property.floors", keyName: "_id" });

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-primary-soft px-4 py-3 text-sm text-primary-text">
        <span className="font-bold">Modo simple</span>
        <span className="flex-1">
          Sin gráficos 3D: más liviano y rápido en equipos con pocos recursos o conexión lenta.
        </span>
        <span className="text-muted-foreground">Usar 3D (pronto)</span>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
        <div className="flex flex-col gap-5">
          <FormSection title={type === "building" ? "Datos del edificio" : "Datos de la propiedad"}>
            <TextField
              name="property.name"
              label={type === "building" ? "Nombre del edificio" : "Nombre de la propiedad"}
            />
            <TextField name="property.address" label="Dirección" autoComplete="street-address" />
            <TextField name="property.districtCity" label="Distrito y ciudad" autoComplete="address-level2" />
          </FormSection>
          <FormSection
            title={type === "room" ? "Tu cuarto" : "Pisos y unidades"}
            description={
              type === "room"
                ? "El cuarto que alquilas, con su precio."
                : "Cada piso puede mezclar departamentos y cuartos. El precio va en lo que se alquila."
            }
          >
            {floors.fields.map((f, i) => (
              <FloorBlock
                key={f._id}
                index={i}
                canRemove={type === "building" && floors.fields.length > 1}
                canAddUnits={type !== "room"}
                onRemove={() => floors.remove(i)}
              />
            ))}
            <FieldError name="property.floors" />
            {type === "building" ? (
              <div>
                <Button
                  type="button"
                  variant="outline"
                  className="h-11"
                  onClick={() => floors.append({ units: [newUnit("room", floors.fields.length + 1, 0)] })}
                >
                  + Agregar piso
                </Button>
              </div>
            ) : null}
          </FormSection>
        </div>
        <BuildingPreview />
      </div>
    </div>
  );
}
