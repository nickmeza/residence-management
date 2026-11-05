import { floorName } from "@/server/building/floors";
import type { BuildingView } from "@/server/business/queries";

import type { SheetTarget } from "./unit-sheet";

// Busca una unidad (o un cuarto dentro de un departamento) por su id, con lo que necesita el panel de edición.
// La usan el modo simple y el 3D: los dos editan con el mismo panel.
export function findSheetTarget(building: BuildingView, id: string | null): SheetTarget | null {
  if (!id) return null;
  for (const f of building.floors) {
    const base = { floorLabel: floorName(f.level), onlyUnit: f.units.length === 1 };
    for (const u of f.units) {
      if (u.id === id) return { ...base, unit: u, parent: null };
      const room = u.rooms.find((r) => r.id === id);
      if (room) return { ...base, unit: room, parent: u };
    }
  }
  return null;
}
