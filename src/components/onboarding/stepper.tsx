import { Check } from "lucide-react";

import { cn } from "@/lib/utils";
import type { StepGroup } from "@/server/onboarding/form";

// Indicador de pasos del prototipo: círculos unidos por una línea. Cada paso dice su estado con texto.
export function Stepper({ groups, current }: { groups: StepGroup[]; current: number }) {
  return (
    <ol className="flex items-center gap-3 overflow-x-auto rounded-xl border bg-card px-4 py-4 shadow-card sm:px-6">
      {groups.map((g, i) => {
        const done = i < current;
        const now = i === current;
        return (
          <li
            key={g.label}
            className="flex flex-1 items-center gap-3 last:flex-none"
            aria-current={now ? "step" : undefined}
          >
            <span className="flex shrink-0 items-center gap-2.5">
              <span
                aria-hidden="true"
                className={cn(
                  "flex size-7 items-center justify-center rounded-full border-2 text-sm font-bold",
                  done && "border-primary bg-primary text-primary-foreground",
                  now && "border-primary bg-card text-primary-text",
                  !done && !now && "border-border bg-card text-muted-foreground",
                )}
              >
                {done ? <Check className="size-3.5" strokeWidth={3} /> : i + 1}
              </span>
              <span
                className={cn(
                  "text-sm whitespace-nowrap",
                  now ? "font-bold" : done ? "font-semibold" : "text-muted-foreground",
                )}
              >
                {g.label}
                <span className="sr-only"> ({done ? "listo" : now ? "actual" : "pendiente"})</span>
              </span>
            </span>
            {i < groups.length - 1 ? (
              <span
                aria-hidden="true"
                className={cn("h-0.5 min-w-6 flex-1", done ? "bg-primary" : "bg-border")}
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
