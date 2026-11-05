import { Box, List } from "lucide-react";

import { cn } from "@/lib/utils";
import type { ViewMode } from "@/lib/view-mode";

const base =
  "flex min-h-9 items-center gap-2 rounded-lg px-3 text-sm font-semibold transition-colors duration-200";
const on = "bg-primary text-primary-foreground shadow-card";
const off = "text-muted-foreground hover:text-foreground";

// Interruptor 3D / Simple (CLAUDE.md, sección 8: siempre debe existir).
// Sin onChange (por ejemplo, en el registro) el 3D aparece como "pronto".
export function ViewModeToggle({
  mode = "simple",
  onChange,
  disable3d,
}: {
  mode?: ViewMode;
  onChange?: (mode: ViewMode) => void;
  // Motivo para no poder usar el 3D (por ejemplo, el navegador no lo permite).
  disable3d?: string;
}) {
  const soon = !onChange;
  return (
    <div role="group" aria-label="Modo de vista" className="flex rounded-xl border bg-card p-1 shadow-card">
      <button
        type="button"
        aria-pressed={mode === "3d"}
        disabled={soon || Boolean(disable3d)}
        title={soon ? "El modo 3D llega pronto" : disable3d}
        onClick={() => onChange?.("3d")}
        className={cn(base, mode === "3d" ? on : off, (soon || disable3d) && "opacity-70")}
      >
        <Box className="size-4" aria-hidden="true" />
        3D {soon ? <span className="text-xs font-normal">(pronto)</span> : null}
      </button>
      <button
        type="button"
        aria-pressed={mode === "simple"}
        onClick={() => onChange?.("simple")}
        className={cn(base, mode === "simple" ? on : off)}
      >
        <List className="size-4" aria-hidden="true" />
        Simple
      </button>
    </div>
  );
}
