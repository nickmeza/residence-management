import type { SceneView } from "@/components/edificio-3d/building-scene";
import type { BuildingView } from "@/server/business/queries";

import { locateUnit, wholeFloorApartment } from "./floor-units";

// La dirección manda: el 3D y el modo simple muestran lo mismo según la página en la que estés.
//   /edificio/[id]                 → el edificio
//   /edificio/[id]/piso/[floorId]  → dentro del piso (o del departamento, si ocupa todo el piso)
//   /edificio/[id]/unidad/[unitId] → la unidad marcada en su piso; un departamento en "Cuartos", por dentro
// Sin three.js: el modo simple también la usa.

export type BuildingRoute = { floorId?: string; unitId?: string; tab?: string };

export const buildingHref = (buildingId: string) => `/edificio/${buildingId}`;
export const floorHref = (buildingId: string, floorId: string) => `/edificio/${buildingId}/piso/${floorId}`;
export const unitHref = (buildingId: string, unitId: string) => `/edificio/${buildingId}/unidad/${unitId}`;

export function parseBuildingPath(pathname: string, tab: string | null): BuildingRoute {
  const [, , , kind, id] = pathname.split("/");
  const extra = tab ?? undefined;
  if (kind === "piso" && id) return { floorId: id, tab: extra };
  if (kind === "unidad" && id) return { unitId: id, tab: extra };
  return {};
}

// Qué muestra el 3D en esta dirección y qué unidad va marcada.
export function sceneFor(
  building: BuildingView,
  route: BuildingRoute,
): { view: SceneView; selectedUnitId: string | null } {
  const building0 = { view: { level: "building" } as SceneView, selectedUnitId: null };
  if (route.floorId) {
    const floor = building.floors.find((f) => f.id === route.floorId);
    if (!floor) return building0;
    const whole = wholeFloorApartment(floor.units);
    return {
      view: whole
        ? { level: "unit", floorId: floor.id, unitId: whole.id }
        : { level: "floor", floorId: floor.id },
      selectedUnitId: null,
    };
  }
  if (route.unitId) {
    const found = locateUnit(building, route.unitId);
    if (!found) return building0;
    const { floor, unit, parent } = found;
    const whole = wholeFloorApartment(floor.units);
    if (parent) {
      return { view: { level: "unit", floorId: floor.id, unitId: parent.id }, selectedUnitId: unit.id };
    }
    // El departamento se ve por dentro en su pestaña Cuartos (o siempre, si ocupa todo el piso).
    if (unit.type === "apartment" && (route.tab === "cuartos" || whole?.id === unit.id)) {
      return { view: { level: "unit", floorId: floor.id, unitId: unit.id }, selectedUnitId: null };
    }
    return { view: { level: "floor", floorId: floor.id }, selectedUnitId: unit.id };
  }
  return building0;
}

// A dónde lleva entrar a una vista del 3D (doble clic).
export function hrefForView(building: BuildingView, view: SceneView): string {
  if (view.level === "building") return buildingHref(building.id);
  if (view.level === "floor") return floorHref(building.id, view.floorId);
  const floor = building.floors.find((f) => f.id === view.floorId);
  if (floor && wholeFloorApartment(floor.units)?.id === view.unitId) return floorHref(building.id, floor.id);
  return `${unitHref(building.id, view.unitId)}?pestana=cuartos`;
}

// Un nivel más arriba (botón "Volver" y Esc en el 3D).
export function parentHref(building: BuildingView, route: BuildingRoute): string | null {
  if (route.floorId) return buildingHref(building.id);
  if (!route.unitId) return null;
  const found = locateUnit(building, route.unitId);
  if (!found) return buildingHref(building.id);
  const { floor, unit, parent } = found;
  const whole = wholeFloorApartment(floor.units);
  if (parent) {
    return whole?.id === parent.id
      ? `${floorHref(building.id, floor.id)}?pestana=cuartos`
      : `${unitHref(building.id, parent.id)}?pestana=cuartos`;
  }
  if (whole?.id === unit.id) return buildingHref(building.id);
  return floorHref(building.id, floor.id);
}
