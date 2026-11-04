"use client";

import { useFormContext, useWatch } from "react-hook-form";

import type { SetupForm } from "@/server/onboarding/form";

import { ChoiceCard } from "./choice-card";
import { FieldError, FormSection } from "./form-field";

export function StepServices() {
  const { setValue, clearErrors } = useFormContext<SetupForm>();
  const services = useWatch<SetupForm, "services">({ name: "services" });

  const toggle = (key: keyof SetupForm["services"]) => {
    setValue(`services.${key}`, !services[key], { shouldDirty: true });
    clearErrors("services");
  };

  return (
    <FormSection
      title="¿Qué servicios ofreces?"
      description="Puedes elegir uno o los dos. Cada servicio es un negocio con sus propios datos."
    >
      <div role="group" aria-label="Servicios" className="grid gap-4 sm:grid-cols-2">
        <ChoiceCard
          kind="check"
          selected={services.residence}
          onSelect={() => toggle("residence")}
          title="Residencia"
          description="Alquilas cuartos o departamentos."
        />
        <ChoiceCard
          kind="check"
          selected={services.mealPlan}
          onSelect={() => toggle("mealPlan")}
          title="Pensión"
          description="Ofreces comidas a residentes o a externos."
        />
        <ChoiceCard
          kind="check"
          selected={false}
          disabled
          onSelect={() => {}}
          title="Lavandería"
          badge="Pronto"
        />
        <ChoiceCard
          kind="check"
          selected={false}
          disabled
          onSelect={() => {}}
          title="Cowork y estudio"
          badge="Pronto"
        />
      </div>
      <FieldError name="services.residence" />
    </FormSection>
  );
}
