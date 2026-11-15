"use client";

import { ChevronDown } from "lucide-react";
import { useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

// Pagos anulados o rechazados, ocultos por defecto (decisión del dueño, 2026-11-15): siguen guardados y en la
// bitácora; aquí solo se muestran si se pide. `children` es la lista ya armada en el servidor.
export function VoidedPayments({ count, children }: { count: number; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  if (!count) return null;
  return (
    <div className="flex flex-col">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-11 items-center gap-1.5 self-start px-1 text-sm font-semibold text-link underline-offset-4 transition-colors duration-200 hover:underline"
      >
        <ChevronDown
          className={cn("size-4 transition-transform duration-200", open && "rotate-180")}
          aria-hidden="true"
        />
        {open ? "Ocultar anulados" : `Mostrar anulados (${count})`}
      </button>
      {open ? children : null}
    </div>
  );
}
