"use client";

import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { FormMessage } from "@/components/auth/auth-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { savePensionSettingsAction } from "@/server/pension/actions";
import { MEAL_LABEL, SERVICE_MODE_LABEL, type MealType, type ServiceMode } from "@/server/pension/rules";
import { SERVICE_MODE_VALUES } from "@/server/pension/schemas";

const card = "rounded-xl border bg-card p-5 shadow-card sm:p-6";

type MealValues = {
  type: MealType;
  active: boolean;
  startTime: string;
  endTime: string;
  singlePrice: string;
};

export type PensionSettingsValues = {
  cancelDeadline: string;
  serviceModes: ServiceMode[];
  seatsPerTurn: string;
  acceptsExternal: boolean;
  diets: string;
  meals: MealValues[];
};

// Configuración de la pensión, pensada para lo simple (una señora que cocina para 5 estudiantes): qué comidas da, a
// qué hora y a cuánto suelta; hasta cuándo se puede cancelar (por defecto se cocina para todos) y cómo entrega.
export function PensionSettingsEditor({
  businessId,
  saved: everSaved,
  initial,
}: {
  businessId: string;
  saved: boolean;
  initial: PensionSettingsValues;
}) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [error, setError] = useState<{ message: string; fields: Record<string, string> }>();
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const set = (patch: Partial<PensionSettingsValues>) => {
    setSaved(false);
    setValues((v) => ({ ...v, ...patch }));
  };
  const setMeal = (type: MealType, patch: Partial<MealValues>) =>
    set({ meals: values.meals.map((m) => (m.type === type ? { ...m, ...patch } : m)) });
  const fieldError = (path: string) =>
    error?.fields[path] ? <p className="text-sm text-danger">{error.fields[path]}</p> : null;

  const save = () =>
    startTransition(async () => {
      setError(undefined);
      const result = await savePensionSettingsAction(businessId, {
        ...values,
        diets: values.diets
          .split(",")
          .map((d) => d.trim())
          .filter(Boolean),
      });
      if (!result.ok) return setError({ message: result.message, fields: result.fieldErrors ?? {} });
      setSaved(true);
      router.refresh();
    });

  return (
    <div className="flex flex-col gap-6">
      {!everSaved ? (
        <p className="rounded-lg bg-warn-soft px-3 py-2.5 text-sm text-warn">
          Todavía no configuraste tu pensión. Revisa los horarios y precios de ejemplo y guarda.
        </p>
      ) : null}

      <section className={card}>
        <h2 className="mb-1 text-lg font-bold">Comidas que sirves</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Marca las que das, su horario y su precio suelto (lo que cuesta una sola comida sin plan).
        </p>
        <ul className="flex flex-col">
          {values.meals.map((m, i) => (
            <li
              key={m.type}
              className="flex flex-wrap items-end gap-3 border-t py-4 first:border-t-0 first:pt-0"
            >
              <label className="flex min-h-11 min-w-36 items-center gap-2 font-semibold">
                <input
                  type="checkbox"
                  className="size-5 accent-primary"
                  checked={m.active}
                  onChange={(e) => setMeal(m.type, { active: e.target.checked })}
                />
                {MEAL_LABEL[m.type]}
              </label>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`${m.type}-start`}>Desde</Label>
                <Input
                  id={`${m.type}-start`}
                  type="time"
                  className="h-11 w-32"
                  disabled={!m.active}
                  value={m.startTime}
                  onChange={(e) => setMeal(m.type, { startTime: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`${m.type}-end`}>Hasta</Label>
                <Input
                  id={`${m.type}-end`}
                  type="time"
                  className="h-11 w-32"
                  disabled={!m.active}
                  value={m.endTime}
                  onChange={(e) => setMeal(m.type, { endTime: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`${m.type}-price`}>Precio suelto (S/)</Label>
                <Input
                  id={`${m.type}-price`}
                  inputMode="decimal"
                  className="h-11 w-32"
                  disabled={!m.active}
                  value={m.singlePrice}
                  onChange={(e) => setMeal(m.type, { singlePrice: e.target.value })}
                />
              </div>
              <div className="w-full">
                {fieldError(`meals.${i}.endTime`)}
                {fieldError(`meals.${i}.singlePrice`)}
                {fieldError(`meals.${i}.startTime`)}
              </div>
            </li>
          ))}
        </ul>
        {fieldError("meals")}
      </section>

      <section className={card}>
        <h2 className="mb-1 text-lg font-bold">Cancelaciones</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Por defecto cocinas para todos tus comensales. Quien no va a comer cancela hasta esta hora del día
          anterior; después, solo tú puedes cambiarlo.
        </p>
        <div className="flex max-w-48 flex-col gap-1.5">
          <Label htmlFor="cancelDeadline">Hasta las (día anterior)</Label>
          <Input
            id="cancelDeadline"
            type="time"
            className="h-11"
            value={values.cancelDeadline}
            onChange={(e) => set({ cancelDeadline: e.target.value })}
          />
          {fieldError("cancelDeadline")}
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Ejemplo: el almuerzo del viernes se puede cancelar hasta el jueves a las{" "}
          {values.cancelDeadline || "—"}.
        </p>
      </section>

      <section className={card}>
        <h2 className="mb-4 text-lg font-bold">Cómo entregas</h2>
        <fieldset className="mb-4">
          <legend className="mb-2 text-sm font-semibold">Formas de entrega</legend>
          <div className="flex flex-wrap gap-x-5">
            {SERVICE_MODE_VALUES.map((mode) => (
              <label key={mode} className="flex min-h-11 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-5 accent-primary"
                  checked={values.serviceModes.includes(mode)}
                  onChange={(e) =>
                    set({
                      serviceModes: e.target.checked
                        ? [...values.serviceModes, mode]
                        : values.serviceModes.filter((x) => x !== mode),
                    })
                  }
                />
                {SERVICE_MODE_LABEL[mode]}
              </label>
            ))}
          </div>
          {fieldError("serviceModes")}
        </fieldset>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="seatsPerTurn">Comensales por turno (opcional)</Label>
            <Input
              id="seatsPerTurn"
              inputMode="numeric"
              className="h-11"
              placeholder="Sin límite"
              value={values.seatsPerTurn}
              onChange={(e) => set({ seatsPerTurn: e.target.value })}
            />
            {fieldError("seatsPerTurn")}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="diets">Dietas que atiendes (opcional)</Label>
            <Input
              id="diets"
              className="h-11"
              placeholder="Por ejemplo: vegetariano, sin gluten"
              value={values.diets}
              onChange={(e) => set({ diets: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">Sepáralas con comas.</p>
            {fieldError("diets")}
          </div>
        </div>
      </section>

      <div className="flex flex-col gap-2">
        <FormMessage message={error?.message} />
        <div className="flex flex-wrap items-center justify-end gap-3">
          {saved ? (
            <span className="flex items-center gap-1 text-sm text-ok">
              <Check className="size-4" aria-hidden="true" /> Guardado
            </span>
          ) : null}
          <Button type="button" className="h-11 px-6" disabled={pending} onClick={save}>
            {pending ? "Guardando…" : "Guardar"}
          </Button>
        </div>
      </div>
    </div>
  );
}
