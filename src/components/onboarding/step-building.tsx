"use client";

import { useFieldArray, useFormContext, useWatch } from "react-hook-form";

import { ConfirmButton } from "@/components/confirm-button";
import { Button } from "@/components/ui/button";
import { floorName } from "@/server/building/floors";
import { formSummary, newRoom, newUnit, type SetupForm, type UnitForm } from "@/server/onboarding/form";

import { ToggleChip } from "./choice-card";
import { FieldError, FormSection, TextField } from "./form-field";

type FloorPath = `property.floors.${number}`;
type UnitPath = `${FloorPath}.units.${number}`;

// Un cuarto dentro de un departamento.
function RoomRow({
  unitPath,
  index,
  priced,
  onRemove,
}: {
  unitPath: UnitPath;
  index: number;
  priced: boolean;
  onRemove: () => void;
}) {
  const name = useWatch<SetupForm, `${UnitPath}.rooms.${number}.name`>({
    name: `${unitPath}.rooms.${index}.name`,
  });
  return (
    <div className="grid items-end gap-3 rounded-lg bg-muted/50 p-3 sm:grid-cols-[1fr_9rem_7rem_auto]">
      <TextField name={`${unitPath}.rooms.${index}.name`} label="Cuarto" />
      {priced ? (
        <TextField
          name={`${unitPath}.rooms.${index}.monthlyPrice`}
          label="Precio mensual"
          prefix="S/"
          inputMode="decimal"
        />
      ) : (
        <p className="pb-3 text-sm text-muted-foreground">Incluido en el departamento</p>
      )}
      <TextField name={`${unitPath}.rooms.${index}.areaM2`} label="m² (opcional)" inputMode="decimal" />
      <ConfirmButton
        trigger={
          <Button type="button" variant="ghost" className="h-11">
            Quitar
          </Button>
        }
        title={`¿Quitar ${name || "este cuarto"}?`}
        description="Se quita de lo que estás armando. Puedes volver a agregarlo."
        confirmLabel="Quitar"
        onConfirm={onRemove}
      />
    </div>
  );
}

// Una unidad del piso: cuarto suelto o departamento (con su modo de alquiler y sus cuartos).
function UnitCard({
  floorIndex,
  index,
  level,
  canRemove,
  onlyUnit,
  onRemove,
}: {
  floorIndex: number;
  index: number;
  level: number;
  canRemove: boolean;
  onlyUnit: boolean;
  onRemove: () => void;
}) {
  const { control, setValue, getValues } = useFormContext<SetupForm>();
  const path: UnitPath = `property.floors.${floorIndex}.units.${index}`;
  const unit = useWatch<SetupForm, UnitPath>({ name: path }) as UnitForm;
  const rooms = useFieldArray({ control, name: `${path}.rooms`, keyName: "_id" });
  const isApartment = unit.type === "apartment";
  const byRoom = isApartment && unit.rentalMode === "by_room";

  const setMode = (mode: UnitForm["rentalMode"]) => {
    setValue(`${path}.rentalMode`, mode, { shouldDirty: true });
    // El precio pasa del departamento a los cuartos (o al revés): se limpia el que ya no aplica.
    if (mode === "by_room") setValue(`${path}.monthlyPrice`, "");
    else getValues(`${path}.rooms`).forEach((_, j) => setValue(`${path}.rooms.${j}.monthlyPrice`, ""));
  };

  return (
    <article className="flex flex-col gap-4 rounded-xl border p-4">
      <header className="flex items-center justify-between gap-2">
        <span className="rounded-full bg-chip px-2.5 py-1 text-xs font-bold text-chip-foreground">
          {isApartment ? "Departamento" : "Cuarto"}
        </span>
        {canRemove ? (
          <ConfirmButton
            trigger={
              <Button type="button" variant="ghost" className="h-11">
                Quitar
              </Button>
            }
            title={`¿Quitar ${unit.name || "esta unidad"}?`}
            description={isApartment ? "Se quitan también sus cuartos." : "Se quita de lo que estás armando."}
            confirmLabel="Quitar"
            onConfirm={onRemove}
          />
        ) : null}
      </header>
      <div className="grid items-start gap-3 sm:grid-cols-[1fr_9rem_7rem]">
        <TextField name={`${path}.name`} label="Nombre" />
        {byRoom ? (
          <p className="text-sm text-muted-foreground sm:pt-8">Precio en cada cuarto</p>
        ) : (
          <TextField name={`${path}.monthlyPrice`} label="Precio mensual" prefix="S/" inputMode="decimal" />
        )}
        <TextField name={`${path}.areaM2`} label="m² (opcional)" inputMode="decimal" />
      </div>

      {isApartment ? (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold">Se alquila</span>
            <div role="radiogroup" aria-label="Cómo se alquila" className="flex flex-wrap gap-2">
              <ToggleChip kind="radio" selected={!byRoom} onToggle={() => setMode("whole")}>
                Completo
              </ToggleChip>
              <ToggleChip kind="radio" selected={byRoom} onToggle={() => setMode("by_room")}>
                Por cuartos
              </ToggleChip>
            </div>
          </div>
          <label className="flex min-h-11 items-center gap-3 text-sm">
            <input
              type="checkbox"
              className="size-5 accent-primary"
              checked={unit.occupiesWholeFloor}
              disabled={!onlyUnit}
              onChange={(e) =>
                setValue(`${path}.occupiesWholeFloor`, e.target.checked, { shouldDirty: true })
              }
            />
            <span>
              Ocupa todo el piso
              <span className="block text-muted-foreground">
                {onlyUnit
                  ? "En el 3D se entra directo al departamento."
                  : "Solo si es la única unidad del piso."}
              </span>
            </span>
          </label>
          <FieldError name={`${path}.occupiesWholeFloor`} />

          <div className="flex flex-col gap-2">
            <span className="text-sm font-semibold">
              {byRoom ? "Cuartos que alquilas" : "Cuartos del departamento (opcional, solo describen)"}
            </span>
            {rooms.fields.map((r, j) => (
              <RoomRow
                key={r._id}
                unitPath={path}
                index={j}
                priced={byRoom}
                onRemove={() => rooms.remove(j)}
              />
            ))}
            <FieldError name={`${path}.rooms`} />
            <div>
              <Button
                type="button"
                variant="outline"
                className="h-11"
                onClick={() => rooms.append(newRoom(getValues(`${path}.name`), rooms.fields.length))}
              >
                + Cuarto en el departamento
              </Button>
            </div>
          </div>
        </div>
      ) : null}
      <span className="sr-only">{`Unidad de ${floorName(level)}`}</span>
    </article>
  );
}

function FloorCard({
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
  const level = index + 1;
  // Con otra unidad en el piso, "ocupa todo el piso" deja de ser posible: se desmarca.
  const add = (type: UnitForm["type"]) => {
    units.fields.forEach((_, i) => setValue(`property.floors.${index}.units.${i}.occupiesWholeFloor`, false));
    units.append(newUnit(type, level, units.fields.length));
  };

  return (
    <section
      className="flex flex-col gap-4 rounded-xl border bg-card p-4 shadow-card sm:p-6"
      aria-label={floorName(level)}
    >
      <header className="flex items-center justify-between gap-2">
        <h3 className="text-base font-bold">
          {floorName(level)}{" "}
          <span className="font-normal text-muted-foreground">
            · {units.fields.length} {units.fields.length === 1 ? "unidad" : "unidades"}
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
      </header>
      {units.fields.map((u, i) => (
        <UnitCard
          key={u._id}
          floorIndex={index}
          index={i}
          level={level}
          canRemove={units.fields.length > 1}
          onlyUnit={units.fields.length === 1}
          onRemove={() => units.remove(i)}
        />
      ))}
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
    </section>
  );
}

export function StepBuilding() {
  const { control } = useFormContext<SetupForm>();
  const type = useWatch<SetupForm, "property.type">({ name: "property.type" });
  const floorsValue = useWatch<SetupForm, "property.floors">({ name: "property.floors" });
  const floors = useFieldArray({ control, name: "property.floors", keyName: "_id" });
  const summary = formSummary(floorsValue);

  return (
    <div className="flex flex-col gap-6">
      <FormSection title="Datos de la propiedad">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            name="property.name"
            label={type === "building" ? "Nombre del edificio" : "Nombre de la propiedad"}
            className="sm:col-span-2"
          />
          <TextField name="property.address" label="Dirección" autoComplete="street-address" />
          <TextField name="property.districtCity" label="Distrito y ciudad" autoComplete="address-level2" />
        </div>
      </FormSection>

      <div className="flex flex-col gap-2">
        <h2 className="text-base font-bold">{type === "room" ? "Tu cuarto" : "Pisos y unidades"}</h2>
        <p className="text-sm text-muted-foreground">
          {type === "room"
            ? "El cuarto que alquilas, con su precio."
            : "Cada piso puede mezclar departamentos y cuartos. El precio va en lo que se alquila."}{" "}
          La ubicación en la planta se calcula sola; podrás ajustarla en el 3D.
        </p>
      </div>

      {floors.fields.map((f, i) => (
        <FloorCard
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

      <aside aria-label="Resumen" className="flex flex-wrap gap-6 rounded-xl border bg-card p-4 shadow-card">
        {[
          ["Pisos", summary.floors],
          ["Departamentos", summary.apartments],
          ["Se alquilan", summary.rentable],
        ].map(([label, value]) => (
          <div key={label}>
            <div className="text-2xl font-bold">{value}</div>
            <div className="text-sm text-muted-foreground">{label}</div>
          </div>
        ))}
      </aside>
    </div>
  );
}
