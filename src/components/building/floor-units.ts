import type { BuildingUnit, BuildingView } from "@/server/business/queries";

// Lo que se alquila en un piso (el precio vive ahí): cuartos sueltos, departamentos completos y los cuartos
// de los departamentos por cuartos.
export const rentableUnits = (units: BuildingUnit[]): BuildingUnit[] =>
  units.flatMap((u) => (u.type === "apartment" && u.rentalMode === "by_room" ? u.rooms : [u]));

// El departamento que ocupa todo el piso, si lo hay: al entrar al piso se muestra directo.
export const wholeFloorApartment = (units: BuildingUnit[]): BuildingUnit | null =>
  units.length === 1 && units[0].type === "apartment" && units[0].occupiesWholeFloor ? units[0] : null;

export type BuildingFloor = BuildingView["floors"][number];

// Busca una unidad (o un cuarto dentro de un departamento) con su piso y su departamento.
export function locateUnit(
  building: BuildingView,
  unitId: string,
): { floor: BuildingFloor; unit: BuildingUnit; parent: BuildingUnit | null } | null {
  for (const floor of building.floors) {
    for (const u of floor.units) {
      if (u.id === unitId) return { floor, unit: u, parent: null };
      const room = u.rooms.find((r) => r.id === unitId);
      if (room) return { floor, unit: room, parent: u };
    }
  }
  return null;
}
