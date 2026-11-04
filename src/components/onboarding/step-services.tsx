"use client";

import { Building2, Check, ChevronDown, Shirt, Soup, Users } from "lucide-react";
import { useState, type ComponentType } from "react";
import { useFormContext, useWatch } from "react-hook-form";

import { cn } from "@/lib/utils";
import type { SetupForm } from "@/server/onboarding/form";

import { FieldError } from "./form-field";

type Service = {
  key: keyof SetupForm["services"];
  title: string;
  description: string;
  includes: string[];
  Icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
};

const SERVICES: Service[] = [
  {
    key: "residence",
    title: "Residencia",
    description: "Alquila cuartos por mes, con contratos, residentes y cobros.",
    includes: ["Pisos y cuartos", "Contratos", "Cobros"],
    Icon: Building2,
  },
  {
    key: "mealPlan",
    title: "Pensión",
    description: "Vende planes de comida con menú semanal y registro de asistencia.",
    includes: ["Planes", "Menú", "Asistencia"],
    Icon: Soup,
  },
];

const COMING_SOON = [
  { title: "Lavandería", Icon: Shirt },
  { title: "Cowork y estudio", Icon: Users },
];

// Tarjeta grande de servicio, como el prototipo: ícono, marca de elegido, título, descripción y lo que incluye.
function ServiceCard({
  service,
  selected,
  onToggle,
}: {
  service: Service;
  selected: boolean;
  onToggle: () => void;
}) {
  const { Icon } = service;
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={selected}
      onClick={onToggle}
      className={cn(
        "relative flex flex-col gap-3 rounded-2xl border-2 bg-card p-6 text-left shadow-card transition-all duration-200",
        "focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
        selected ? "border-primary" : "border-border hover:border-primary/50",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "absolute top-5 right-5 flex size-6 items-center justify-center rounded-full border-2",
          selected ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card",
        )}
      >
        {selected ? <Check className="size-3.5" strokeWidth={3} /> : null}
      </span>
      <span className="flex size-14 items-center justify-center rounded-xl bg-primary-soft text-primary-text">
        <Icon className="size-7" aria-hidden />
      </span>
      <span className="text-xl font-bold">{service.title}</span>
      <span className="text-sm text-muted-foreground">{service.description}</span>
      <span className="flex flex-wrap gap-2">
        {service.includes.map((i) => (
          <span
            key={i}
            className="rounded-full bg-chip px-2.5 py-1 text-xs font-semibold text-chip-foreground"
          >
            {i}
          </span>
        ))}
      </span>
      <span className="sr-only">{selected ? "Elegido" : "No elegido"}</span>
    </button>
  );
}

export function StepServices() {
  const { setValue, clearErrors } = useFormContext<SetupForm>();
  const services = useWatch<SetupForm, "services">({ name: "services" });
  const [more, setMore] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      <div role="group" aria-label="Servicios" className="grid gap-5 md:grid-cols-2">
        {SERVICES.map((s) => (
          <ServiceCard
            key={s.key}
            service={s}
            selected={services[s.key]}
            onToggle={() => {
              setValue(`services.${s.key}`, !services[s.key], { shouldDirty: true });
              clearErrors("services");
            }}
          />
        ))}
      </div>
      <FieldError name="services.residence" />
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed px-5 py-4">
        <span className="text-sm text-muted-foreground">
          Más servicios para tu negocio, como lavandería y cowork, estarán disponibles pronto.
        </span>
        <button
          type="button"
          aria-expanded={more}
          onClick={() => setMore((m) => !m)}
          className="flex min-h-11 items-center gap-1 text-sm font-semibold text-link"
        >
          {more ? "Ver menos opciones" : "Ver más opciones"}
          <ChevronDown
            className={cn("size-4 transition-transform duration-200", more && "rotate-180")}
            aria-hidden="true"
          />
        </button>
      </div>
      {more ? (
        <ul className="grid gap-4 md:grid-cols-2">
          {COMING_SOON.map(({ title, Icon }) => (
            <li key={title} className="flex items-center gap-3 rounded-xl border bg-card p-4 opacity-70">
              <Icon className="size-6 text-muted-foreground" aria-hidden="true" />
              <span className="flex-1 font-semibold">{title}</span>
              <span className="rounded-full bg-chip px-2.5 py-1 text-xs font-bold text-chip-foreground">
                Pronto
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

// Texto de la barra inferior: "2 Servicios seleccionados: Residencia, Pensión".
export function ServicesFooter() {
  const services = useWatch<SetupForm, "services">({ name: "services" });
  const chosen = SERVICES.filter((s) => services[s.key]).map((s) => s.title);
  return (
    <span className="flex items-center gap-2 text-sm text-muted-foreground">
      <span className="flex size-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
        {chosen.length}
      </span>
      {chosen.length ? `Servicios seleccionados: ${chosen.join(", ")}` : "Elige al menos un servicio"}
    </span>
  );
}
