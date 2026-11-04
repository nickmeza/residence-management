"use client";

import { useFormContext, useWatch } from "react-hook-form";

import { fitFloorsToType, type PropertyType, type SetupForm } from "@/server/onboarding/form";

import { ChoiceCard } from "./choice-card";
import { FieldError, FormSection } from "./form-field";

const OPTIONS: { type: PropertyType; title: string; description: string; example: string }[] = [
  {
    type: "room",
    title: "Un cuarto",
    description: "Alquilas un cuarto libre de tu propia casa.",
    example: "Tu casa tiene un cuarto disponible y tú vives en ella.",
  },
  {
    type: "floor",
    title: "Un piso",
    description: "Alquilas los cuartos de un piso de tu casa.",
    example: "Vives en el primer piso y alquilas los cuartos del segundo.",
  },
  {
    type: "building",
    title: "Un edificio",
    description: "Alquilas departamentos y cuartos en varios pisos.",
    example: "Un edificio con departamentos y cuartos, con o sin encargado.",
  },
];

export function StepOffer() {
  const { setValue, getValues, clearErrors } = useFormContext<SetupForm>();
  const type = useWatch<SetupForm, "property.type">({ name: "property.type" });
  const lives = useWatch<SetupForm, "property.ownerLivesHere">({ name: "property.ownerLivesHere" });

  const choose = (next: PropertyType) => {
    setValue("property.type", next, { shouldDirty: true });
    setValue("property.floors", fitFloorsToType(next, getValues("property.floors")), { shouldDirty: true });
    clearErrors("property.type");
  };

  return (
    <div className="flex flex-col gap-6">
      <FormSection
        title="¿Qué ofreces?"
        description="Elige el tamaño de lo que alquilas. Después defines las unidades."
      >
        <div role="radiogroup" aria-label="Qué ofreces" className="grid gap-4 md:grid-cols-3">
          {OPTIONS.map((o) => (
            <ChoiceCard
              key={o.type}
              selected={type === o.type}
              onSelect={() => choose(o.type)}
              title={o.title}
              description={
                <>
                  {o.description}
                  <span className="mt-1 block">
                    <b>Ejemplo:</b> {o.example}
                  </span>
                </>
              }
            />
          ))}
        </div>
        <FieldError name="property.type" />
      </FormSection>
      <FormSection title="¿Vives ahí?">
        <div role="radiogroup" aria-label="Vives en la propiedad" className="grid gap-3 sm:grid-cols-2">
          <ChoiceCard
            selected={lives === "yes"}
            onSelect={() => {
              setValue("property.ownerLivesHere", "yes", { shouldDirty: true });
              clearErrors("property.ownerLivesHere");
            }}
            title="Sí, vivo en la propiedad"
            description="Tú atiendes a los residentes directamente."
          />
          <ChoiceCard
            selected={lives === "no"}
            onSelect={() => {
              setValue("property.ownerLivesHere", "no", { shouldDirty: true });
              clearErrors("property.ownerLivesHere");
            }}
            title="No, la administra un encargado"
            description="Podrás registrar a tu encargado más adelante."
          />
        </div>
        <FieldError name="property.ownerLivesHere" />
      </FormSection>
    </div>
  );
}
