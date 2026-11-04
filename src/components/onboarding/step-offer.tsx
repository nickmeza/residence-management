"use client";

import { Check } from "lucide-react";
import { useFormContext, useWatch } from "react-hook-form";

import { cn } from "@/lib/utils";
import { fitFloorsToType, type PropertyType, type SetupForm } from "@/server/onboarding/form";

import { FieldError, FormSection } from "./form-field";
import { IsoIllustration, IsoLegend } from "./iso-illustration";

const OPTIONS: { type: PropertyType; title: string; description: string; example: string; tag: string }[] = [
  {
    type: "room",
    title: "Un cuarto",
    description: "Alquilas un cuarto libre de tu propia casa.",
    example: "tu casa tiene un cuarto disponible y tú vives en ella.",
    tag: "Sin pisos",
  },
  {
    type: "floor",
    title: "Un piso",
    description: "Alquilas los cuartos de un piso de tu casa.",
    example: "vives en el primer piso y alquilas los cuartos del segundo.",
    tag: "Un solo nivel",
  },
  {
    type: "building",
    title: "Un edificio",
    description: "Alquilas departamentos y cuartos en varios pisos.",
    example: "un edificio con departamentos y cuartos, con o sin encargado.",
    tag: "Varios pisos",
  },
];

// Círculo de selección de las tarjetas (arriba a la derecha en el prototipo).
function Radio({ selected }: { selected: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-6 shrink-0 items-center justify-center rounded-full border-2",
        selected ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card",
      )}
    >
      {selected ? <Check className="size-3.5" strokeWidth={3} /> : null}
    </span>
  );
}

export function StepOffer() {
  const { setValue, getValues, clearErrors } = useFormContext<SetupForm>();
  const type = useWatch<SetupForm, "property.type">({ name: "property.type" });
  const lives = useWatch<SetupForm, "property.ownerLivesHere">({ name: "property.ownerLivesHere" });

  const choose = (next: PropertyType) => {
    setValue("property.type", next, { shouldDirty: true });
    setValue("property.floors", fitFloorsToType(next, getValues("property.floors")), { shouldDirty: true });
    clearErrors("property.type");
  };
  const chooseLives = (value: "yes" | "no") => {
    setValue("property.ownerLivesHere", value, { shouldDirty: true });
    clearErrors("property.ownerLivesHere");
  };

  return (
    <div className="flex flex-col gap-6">
      <IsoLegend />
      <div role="radiogroup" aria-label="Qué ofreces" className="grid gap-5 md:grid-cols-3">
        {OPTIONS.map((o) => {
          const selected = type === o.type;
          return (
            <button
              key={o.type}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => choose(o.type)}
              className={cn(
                "relative flex flex-col gap-2.5 rounded-2xl border-2 bg-card p-4 pb-5 text-left shadow-card transition-all duration-200",
                "focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                selected ? "border-primary" : "border-border hover:border-primary/50",
              )}
            >
              <span className="absolute top-4 right-4">
                <Radio selected={selected} />
              </span>
              <span className="mb-1 block rounded-xl bg-muted/60 px-2 pt-3 pb-1">
                <IsoIllustration type={o.type} />
              </span>
              <span className="px-1.5 text-xl font-bold">{o.title}</span>
              <span className="px-1.5 text-sm text-muted-foreground">{o.description}</span>
              <span className="px-1.5 text-sm text-muted-foreground">
                <b className="text-foreground">Ejemplo:</b> {o.example}
              </span>
              <span className="px-1.5">
                <span className="rounded-full bg-chip px-2.5 py-1 text-xs font-semibold text-chip-foreground">
                  {o.tag}
                </span>
              </span>
            </button>
          );
        })}
      </div>
      <FieldError name="property.type" />

      <FormSection title="¿Vives ahí?">
        <div role="radiogroup" aria-label="Vives en la propiedad" className="flex flex-wrap gap-3">
          {(
            [
              ["yes", "Sí, vivo en la propiedad", "Tú atiendes a los residentes directamente."],
              ["no", "No, la administra un encargado", "Podrás registrar a tu encargado y sus permisos."],
            ] as const
          ).map(([value, title, description]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={lives === value}
              onClick={() => chooseLives(value)}
              className={cn(
                "flex min-w-56 flex-1 items-start gap-3 rounded-xl border-2 bg-card px-4 py-3.5 text-left transition-all duration-200",
                "focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                lives === value ? "border-primary" : "border-border hover:border-primary/50",
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "mt-0.5 size-5 shrink-0 rounded-full border-2 bg-card",
                  lives === value ? "border-[6px] border-primary" : "border-border",
                )}
              />
              <span>
                <span className="block font-bold">{title}</span>
                <span className="mt-0.5 block text-sm text-muted-foreground">{description}</span>
              </span>
            </button>
          ))}
        </div>
        <FieldError name="property.ownerLivesHere" />
      </FormSection>
    </div>
  );
}

const OFFER_TEXT = { room: "un cuarto", floor: "un piso", building: "un edificio" } as const;

// Texto de la barra inferior: "Ofreces: un edificio · Vives ahí: no".
export function OfferFooter() {
  const type = useWatch<SetupForm, "property.type">({ name: "property.type" });
  const lives = useWatch<SetupForm, "property.ownerLivesHere">({ name: "property.ownerLivesHere" });
  return (
    <span className="text-sm text-muted-foreground">
      Ofreces: {type ? OFFER_TEXT[type] : "sin elegir"} · Vives ahí:{" "}
      {lives === "yes" ? "sí" : lives === "no" ? "no" : "sin elegir"}
    </span>
  );
}
