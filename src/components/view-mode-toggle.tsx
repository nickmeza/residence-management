import { Box, List } from "lucide-react";

// Interruptor 3D / Simple (CLAUDE.md, sección 8: siempre debe existir).
// En la Fase 2 solo existe el modo simple; el 3D llega en la Fase 3.
export function ViewModeToggle() {
  return (
    <div role="group" aria-label="Modo de vista" className="flex rounded-xl border bg-card p-1 shadow-card">
      <button
        type="button"
        disabled
        aria-pressed={false}
        title="El modo 3D llega pronto"
        className="flex min-h-9 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-muted-foreground opacity-70"
      >
        <Box className="size-4" aria-hidden="true" />
        3D <span className="text-xs font-normal">(pronto)</span>
      </button>
      <button
        type="button"
        aria-pressed
        className="flex min-h-9 items-center gap-2 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground shadow-card"
      >
        <List className="size-4" aria-hidden="true" />
        Simple
      </button>
    </div>
  );
}
