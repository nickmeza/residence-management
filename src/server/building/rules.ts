// Reglas de negocio de un piso y sus unidades (docs/reglas-de-negocio.md). Funciones puras.
import {
  rectInsideOutline,
  rectInsideRect,
  rectOnGrid,
  rectsOverlap,
  type Point,
  type Rect,
} from "./geometry";

export type UnitType = "apartment" | "room";
export type RentalMode = "whole" | "by_room";

// Lo mínimo de una unidad que necesitan las reglas. id puede ser temporal (unidad aún sin guardar).
export type UnitInput = Rect & {
  id: string;
  parentId: string | null;
  type: UnitType;
  name: string;
  rentalMode: RentalMode | null;
  occupiesWholeFloor: boolean;
  monthlyPrice: string | null;
};

export type FloorProblem =
  | { code: "outside_slab"; unitId: string }
  | { code: "outside_parent"; unitId: string }
  | { code: "overlap"; unitIds: [string, string] }
  | { code: "off_grid"; unitId: string }
  | { code: "whole_floor_not_alone"; unitId: string }
  | { code: "parent_not_apartment"; unitId: string }
  | { code: "parent_missing"; unitId: string }
  | { code: "price_not_allowed"; unitId: string }
  | { code: "duplicate_name"; unitIds: [string, string] };

// ¿Se alquila por sí misma? Cuarto suelto, departamento completo o cuarto de un departamento por cuartos.
export function isRentable(unit: UnitInput, byId: Map<string, UnitInput>): boolean {
  if (unit.type === "apartment") return unit.rentalMode === "whole";
  if (!unit.parentId) return true;
  return byId.get(unit.parentId)?.rentalMode === "by_room";
}

// Revisa todas las reglas de un piso. Devuelve la lista de problemas (vacía si está bien).
export function floorProblems(outline: Point[], units: UnitInput[]): FloorProblem[] {
  const problems: FloorProblem[] = [];
  const byId = new Map(units.map((u) => [u.id, u]));
  const topLevel = units.filter((u) => !u.parentId);

  for (const unit of units) {
    if (!rectOnGrid(unit)) problems.push({ code: "off_grid", unitId: unit.id });
    if (!rectInsideOutline(unit, outline)) problems.push({ code: "outside_slab", unitId: unit.id });

    if (unit.parentId) {
      const parent = byId.get(unit.parentId);
      if (!parent) problems.push({ code: "parent_missing", unitId: unit.id });
      else if (parent.type !== "apartment") problems.push({ code: "parent_not_apartment", unitId: unit.id });
      else if (!rectInsideRect(unit, parent)) problems.push({ code: "outside_parent", unitId: unit.id });
    }

    // "Ocupa todo el piso" solo si el piso tiene ese único departamento y nada más suelto.
    if (unit.occupiesWholeFloor && (unit.type !== "apartment" || topLevel.length !== 1)) {
      problems.push({ code: "whole_floor_not_alone", unitId: unit.id });
    }

    // El precio vive en lo que se alquila: lo que no se alquila solo no lleva precio.
    if (unit.monthlyPrice !== null && !isRentable(unit, byId)) {
      problems.push({ code: "price_not_allowed", unitId: unit.id });
    }
  }

  // Solapes: entre unidades sueltas del piso, y entre cuartos de un mismo departamento.
  const groups = new Map<string | null, UnitInput[]>();
  for (const unit of units) groups.set(unit.parentId, [...(groups.get(unit.parentId) ?? []), unit]);
  for (const siblings of groups.values()) {
    for (let i = 0; i < siblings.length; i++) {
      for (let j = i + 1; j < siblings.length; j++) {
        if (rectsOverlap(siblings[i], siblings[j])) {
          problems.push({ code: "overlap", unitIds: [siblings[i].id, siblings[j].id] });
        }
      }
    }
  }

  // Nombres repetidos en el mismo piso confunden ("Cuarto 202" dos veces).
  const seen = new Map<string, string>();
  for (const unit of units) {
    const key = unit.name.trim().toLowerCase();
    const other = seen.get(key);
    if (other) problems.push({ code: "duplicate_name", unitIds: [other, unit.id] });
    else seen.set(key, unit.id);
  }

  return problems;
}

export type BuildingSummary = { floors: number; apartments: number; rentable: number };

export function buildingSummary(floors: { units: UnitInput[] }[]): BuildingSummary {
  let apartments = 0;
  let rentable = 0;
  for (const floor of floors) {
    const byId = new Map(floor.units.map((u) => [u.id, u]));
    for (const unit of floor.units) {
      if (unit.type === "apartment") apartments++;
      if (isRentable(unit, byId)) rentable++;
    }
  }
  return { floors: floors.length, apartments, rentable };
}
