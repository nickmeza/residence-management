import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type BadgeTone = "ok" | "warn" | "danger" | "neutral" | "primary";

const TONE: Record<BadgeTone, string> = {
  ok: "bg-ok-soft text-ok",
  warn: "bg-warn-soft text-warn",
  danger: "bg-danger-soft text-danger",
  neutral: "bg-chip text-chip-foreground",
  primary: "bg-primary-soft text-primary-text",
};

// Etiqueta de estado. Siempre lleva texto además del color (CLAUDE.md, sección 9).
export function StatusBadge({ tone, children }: { tone: BadgeTone; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold whitespace-nowrap",
        TONE[tone],
      )}
    >
      {children}
    </span>
  );
}
