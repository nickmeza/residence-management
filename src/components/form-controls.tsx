import type { ReactNode } from "react";

import { Label } from "@/components/ui/label";

// Piezas de formulario de Fase 7 (mantenimiento, comunicados, postulantes, ingresos): etiqueta, ayuda y error debajo.
export const selectClass =
  "h-11 w-full rounded-lg border border-input bg-transparent px-2.5 text-base md:text-sm";
export const textareaClass =
  "w-full rounded-lg border border-input bg-transparent px-3 py-2 text-base md:text-sm";

export function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && !error ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
      {error ? (
        <span id={`${id}-error`} className="text-sm text-danger">
          {error}
        </span>
      ) : null}
    </div>
  );
}
