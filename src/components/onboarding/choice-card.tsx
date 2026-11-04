import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type ChoiceCardProps = {
  selected: boolean;
  onSelect: () => void;
  title: string;
  description?: ReactNode;
  badge?: string;
  disabled?: boolean;
  // "radio": una sola opción del grupo; "check": se pueden marcar varias.
  kind?: "radio" | "check";
};

// Opción grande para elegir (servicio, tipo de propiedad…). Lleva texto "Elegido" además del color.
export function ChoiceCard({
  selected,
  onSelect,
  title,
  description,
  badge,
  disabled,
  kind = "radio",
}: ChoiceCardProps) {
  return (
    <button
      type="button"
      role={kind === "radio" ? "radio" : "checkbox"}
      aria-checked={selected}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "flex min-h-11 w-full flex-col gap-1 rounded-xl border-2 bg-card p-4 text-left transition-all duration-200",
        "focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
        selected ? "border-primary bg-primary-soft" : "border-border hover:border-primary/50",
        disabled && "cursor-not-allowed opacity-60 hover:border-border",
      )}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="text-base font-bold">{title}</span>
        {selected ? (
          <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground">
            Elegido
          </span>
        ) : badge ? (
          <span className="rounded-full bg-chip px-2 py-0.5 text-xs font-bold text-chip-foreground">
            {badge}
          </span>
        ) : null}
      </span>
      {description ? <span className="text-sm text-muted-foreground">{description}</span> : null}
    </button>
  );
}

// Interruptor pequeño (métodos de pago, modo de alquiler…).
export function ToggleChip({
  selected,
  onToggle,
  children,
  kind = "check",
}: {
  selected: boolean;
  onToggle: () => void;
  children: ReactNode;
  kind?: "radio" | "check";
}) {
  return (
    <button
      type="button"
      role={kind === "radio" ? "radio" : "checkbox"}
      aria-checked={selected}
      onClick={onToggle}
      className={cn(
        "inline-flex min-h-11 items-center gap-2 rounded-lg border-2 px-3 text-sm font-semibold transition-all duration-200",
        "focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
        selected
          ? "border-primary bg-primary-soft text-primary-text"
          : "border-border bg-card hover:border-primary/50",
      )}
    >
      {selected ? <span aria-hidden="true">✓</span> : null}
      {children}
    </button>
  );
}
