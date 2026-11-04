import { cn } from "@/lib/utils";
import { STEP_LABELS, type StepId } from "@/server/onboarding/form";

// Indicador de pasos. Cada paso dice su estado con texto (para lectores de pantalla) además del color.
export function Stepper({ steps, current }: { steps: StepId[]; current: number }) {
  return (
    <ol className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border bg-card px-4 py-3 shadow-card">
      {steps.map((step, i) => {
        const state = i < current ? "Listo" : i === current ? "Actual" : "Pendiente";
        return (
          <li
            key={step}
            className="flex items-center gap-2"
            aria-current={i === current ? "step" : undefined}
          >
            <span
              className={cn(
                "flex size-7 items-center justify-center rounded-full border-2 text-xs font-bold",
                i < current && "border-primary bg-primary text-primary-foreground",
                i === current && "border-primary text-primary-text",
                i > current && "border-border text-muted-foreground",
              )}
              aria-hidden="true"
            >
              {i < current ? "✓" : i + 1}
            </span>
            <span className={cn("text-sm", i === current ? "font-bold" : "text-muted-foreground")}>
              {STEP_LABELS[step]}
              <span className="sr-only"> ({state})</span>
            </span>
            {i < steps.length - 1 ? (
              <span className="hidden h-0.5 w-6 bg-border sm:block" aria-hidden="true" />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
