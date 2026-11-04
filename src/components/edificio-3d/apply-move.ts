// Aplica un movimiento a los datos que se muestran, antes de que el servidor confirme
// ("cambio optimista"). Función pura: recibe el edificio y devuelve una copia con el cambio.
import { snapToGrid } from "@/server/building/geometry";
import type { BuildingUnit, BuildingView } from "@/server/business/queries";

export type PendingMove =
  { type: "unit"; id: string; x: number; z: number } | { type: "floor"; id: string; level: number };

function moveUnit(units: BuildingUnit[], id: string, x: number, z: number): BuildingUnit[] {
  return units.map((u) => {
    if (u.id === id) {
      // Un departamento lleva a sus cuartos con él (igual que en el servidor).
      const dx = snapToGrid(x - u.rect.x);
      const dz = snapToGrid(z - u.rect.z);
      return {
        ...u,
        rect: { ...u.rect, x, z },
        rooms: u.rooms.map((r) => ({
          ...r,
          rect: { ...r.rect, x: snapToGrid(r.rect.x + dx), z: snapToGrid(r.rect.z + dz) },
        })),
      };
    }
    return u.rooms.some((r) => r.id === id) ? { ...u, rooms: moveUnit(u.rooms, id, x, z) } : u;
  });
}

export function applyMove(building: BuildingView, move: PendingMove): BuildingView {
  if (move.type === "unit") {
    return {
      ...building,
      floors: building.floors.map((f) => ({ ...f, units: moveUnit(f.units, move.id, move.x, move.z) })),
    };
  }
  const from = building.floors.findIndex((f) => f.id === move.id);
  if (from < 0) return building;
  const floors = [...building.floors];
  const [moved] = floors.splice(from, 1);
  floors.splice(Math.min(Math.max(move.level - 1, 0), floors.length), 0, moved);
  return { ...building, floors: floors.map((f, i) => ({ ...f, level: i + 1 })) };
}
