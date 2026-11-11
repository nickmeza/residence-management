// Qué documentos se le piden a un residente. Funciones puras.

export type UnitType = "room" | "apartment";

export type RequirementRule = { id: string; unitType: UnitType; required: boolean; active: boolean };

// Se le pide un requisito si está activo, es obligatorio, es de la lista de lo que alquila (un cuarto dentro de
// un departamento "por cuartos" es un cuarto) y no tiene excepción. Sin unidad todavía no se sabe qué lista va.
// Los opcionales nunca se le piden: no los ve y los sube el arrendador.
export function askedRequirements<T extends RequirementRule>(
  requirements: T[],
  unitType: UnitType | null,
  exemptIds: readonly string[],
): T[] {
  if (!unitType) return [];
  return requirements.filter(
    (r) => r.active && r.required && r.unitType === unitType && !exemptIds.includes(r.id),
  );
}
