import { cn } from "@/lib/utils";
import { STATUS_LABEL, type UnitStatus } from "@/server/building/status";

// Cada estado lleva texto además de color (CLAUDE.md, sección 9).
const STATUS_STYLE: Record<UnitStatus, string> = {
  available: "bg-ok-soft text-ok",
  occupied: "bg-danger-soft text-danger",
  maintenance: "bg-warn-soft text-warn",
};

export function StatusChip({ status }: { status: UnitStatus }) {
  return (
    <span
      className={cn("rounded-full px-2.5 py-1 text-xs font-bold whitespace-nowrap", STATUS_STYLE[status])}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}
