// Convierte lo configurado en el registro en filas listas para guardar: pisos con su losa y
// unidades con su posición. Función pura: no toca la base; así se prueba sin conexión.
import { planFloor, type PlannedUnit } from "../building/layout";
import { floorProblems, type UnitInput } from "../building/rules";
import type { Point } from "../building/geometry";
import type { PropertySetup } from "./schema";

export type UnitRow = {
  key: string;
  parentKey: string | null;
  type: "apartment" | "room";
  name: string;
  rentalMode: "whole" | "by_room" | null;
  occupiesWholeFloor: boolean;
  monthlyPrice: string | null;
  areaM2: string | null;
  posX: number;
  posZ: number;
  width: number;
  depth: number;
};

export type FloorRow = { level: number; outline: Point[]; units: UnitRow[] };

export function buildFloors(property: PropertySetup): FloorRow[] {
  return property.floors.map((floor, index) => {
    const planned: PlannedUnit[] = floor.units.map((u) => ({
      key: u.key,
      type: u.type,
      areaM2: u.areaM2,
      rooms: u.type === "apartment" ? u.rooms.map((r) => ({ key: r.key, areaM2: r.areaM2 })) : undefined,
    }));
    const plan = planFloor(planned);
    const rectOf = (key: string) => {
      const rect = plan.rects.get(key);
      if (!rect) throw new Error(`Falta la posición de ${key}`);
      return { posX: rect.x, posZ: rect.z, width: rect.width, depth: rect.depth };
    };

    const units: UnitRow[] = [];
    for (const u of floor.units) {
      units.push({
        key: u.key,
        parentKey: null,
        type: u.type,
        name: u.name,
        rentalMode: u.type === "apartment" ? u.rentalMode : null,
        occupiesWholeFloor: u.type === "apartment" && u.occupiesWholeFloor,
        monthlyPrice: u.type === "apartment" && u.rentalMode === "by_room" ? null : u.monthlyPrice,
        areaM2: u.areaM2 === null ? null : String(u.areaM2),
        ...rectOf(u.key),
      });
      if (u.type !== "apartment") continue;
      for (const r of u.rooms) {
        units.push({
          key: r.key,
          parentKey: u.key,
          type: "room",
          name: r.name,
          rentalMode: null,
          occupiesWholeFloor: false,
          monthlyPrice: u.rentalMode === "by_room" ? r.monthlyPrice : null,
          areaM2: r.areaM2 === null ? null : String(r.areaM2),
          ...rectOf(r.key),
        });
      }
    }

    // Red de seguridad: lo armado debe cumplir todas las reglas del piso antes de guardarse.
    const asRules: UnitInput[] = units.map((u) => ({
      id: u.key,
      parentId: u.parentKey,
      type: u.type,
      name: u.name,
      rentalMode: u.rentalMode,
      occupiesWholeFloor: u.occupiesWholeFloor,
      monthlyPrice: u.monthlyPrice,
      x: u.posX,
      z: u.posZ,
      width: u.width,
      depth: u.depth,
    }));
    const problems = floorProblems(plan.outline, asRules);
    if (problems.length) {
      throw new Error(`El piso ${index + 1} no cumple las reglas: ${problems.map((p) => p.code).join(", ")}`);
    }

    return { level: index + 1, outline: plan.outline, units };
  });
}
