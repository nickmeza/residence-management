// Estado de una unidad: no se guarda, se deriva (docs/reglas-de-negocio.md, "Estado de la unidad").
//   - ocupado: tiene un contrato vigente (Fase 4);
//   - mantenimiento: tiene una orden de mantenimiento abierta (Fase 7);
//   - disponible: en cualquier otro caso.
// Mientras no existan contratos ni mantenimiento, toda unidad está disponible.
export type UnitStatus = "available" | "occupied" | "maintenance";

export function unitStatus(
  input: { hasActiveContract?: boolean; hasOpenMaintenance?: boolean } = {},
): UnitStatus {
  if (input.hasOpenMaintenance) return "maintenance";
  if (input.hasActiveContract) return "occupied";
  return "available";
}

export const STATUS_LABEL: Record<UnitStatus, string> = {
  available: "Disponible",
  occupied: "Ocupado",
  maintenance: "Mantenimiento",
};
