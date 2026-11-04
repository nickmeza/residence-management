"use client";

import { Building2, ChevronDown, Soup } from "lucide-react";
import { useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export type SwitcherOption = {
  id: string;
  service: "residence" | "meal_plan";
  name: string;
  // Texto de estado (por ejemplo "Completo" o "Falta completar"), además del color.
  status?: { label: string; ok: boolean };
};

const SERVICE_LABEL = { residence: "Residencia", meal_plan: "Pensión" } as const;
const ServiceIcon = ({ service, className }: { service: SwitcherOption["service"]; className?: string }) =>
  service === "residence" ? (
    <Building2 className={className} aria-hidden="true" />
  ) : (
    <Soup className={className} aria-hidden="true" />
  );

// Selector de negocio al estilo de GCP: un botón con el negocio actual que abre una ventana para elegir otro.
export function BusinessSwitcher({
  options,
  value,
  onChange,
  className,
}: {
  options: SwitcherOption[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.id === value) ?? options[0];
  if (!current) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <button
            type="button"
            className={cn(
              "flex min-h-11 w-full items-center gap-3 rounded-lg border bg-card px-3 text-left shadow-card transition-colors duration-200 hover:bg-muted sm:w-auto",
              className,
            )}
          />
        }
      >
        <ServiceIcon service={current.service} className="size-5 text-primary-text" />
        <span className="min-w-0 flex-1">
          <span className="block text-xs text-muted-foreground">{SERVICE_LABEL[current.service]}</span>
          <span className="block truncate text-sm font-semibold">{current.name || "Sin nombre"}</span>
        </span>
        <ChevronDown className="size-4 text-muted-foreground" aria-hidden="true" />
        <span className="sr-only">Cambiar de negocio</span>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Elige un negocio</DialogTitle>
          <DialogDescription>Cada negocio tiene sus propios datos, contacto y cobros.</DialogDescription>
        </DialogHeader>
        <ul className="flex flex-col gap-2">
          {options.map((o) => (
            <li key={o.id}>
              <button
                type="button"
                aria-current={o.id === current.id ? "true" : undefined}
                onClick={() => {
                  onChange(o.id);
                  setOpen(false);
                }}
                className={cn(
                  "flex min-h-11 w-full items-center gap-3 rounded-lg border-2 p-3 text-left transition-colors duration-200",
                  o.id === current.id ? "border-primary bg-primary-soft" : "border-border hover:bg-muted",
                )}
              >
                <ServiceIcon service={o.service} className="size-5 text-primary-text" />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{o.name || "Sin nombre"}</span>
                  <span className="block text-sm text-muted-foreground">{SERVICE_LABEL[o.service]}</span>
                </span>
                {o.status ? (
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-xs font-bold",
                      o.status.ok ? "bg-ok-soft text-ok" : "bg-warn-soft text-warn",
                    )}
                  >
                    {o.status.label}
                  </span>
                ) : null}
                {o.id === current.id ? <span className="sr-only">(actual)</span> : null}
              </button>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
