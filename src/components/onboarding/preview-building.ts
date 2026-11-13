// Convierte lo que se va armando en el registro (todavía sin guardar) en un edificio que el 3D puede dibujar.
// Usa la misma ubicación automática que el servidor al guardar (planFloor), así la vista previa coincide.
import { planFloor } from "@/server/building/layout";
import { formSummary, type SetupForm, type UnitForm } from "@/server/onboarding/form";
import type { BuildingUnit, BuildingView } from "@/server/business/queries";

const toNumber = (v: string) => (v.trim() === "" || !Number.isFinite(Number(v)) ? null : Number(v));

export function previewBuilding(property: SetupForm["property"]): BuildingView {
  const floors = property.floors.map((floor, i) => {
    const plan = planFloor(
      floor.units.map((u) => ({
        key: u.key,
        type: u.type,
        areaM2: toNumber(u.areaM2),
        rooms:
          u.type === "apartment"
            ? u.rooms.map((r) => ({ key: r.key, areaM2: toNumber(r.areaM2) }))
            : undefined,
      })),
    );
    const rectOf = (key: string) => plan.rects.get(key) ?? { x: 0, z: 0, width: 3, depth: 3 };
    const base = (key: string, name: string, price: string): Omit<BuildingUnit, "type" | "rooms"> => ({
      id: key,
      name: name || "Sin nombre",
      rentalMode: null,
      occupiesWholeFloor: false,
      monthlyPrice: toNumber(price) === null ? null : price,
      areaM2: null,
      bathroom: null,
      furnished: false,
      spaceType: null,
      rect: rectOf(key),
      status: "available",
      occupant: null,
    });
    const unit = (u: UnitForm): BuildingUnit => ({
      ...base(u.key, u.name, u.type === "apartment" && u.rentalMode === "by_room" ? "" : u.monthlyPrice),
      type: u.type,
      rentalMode: u.type === "apartment" ? u.rentalMode : null,
      occupiesWholeFloor: u.type === "apartment" && u.occupiesWholeFloor,
      rooms:
        u.type === "apartment"
          ? u.rooms.map((r) => ({
              ...base(r.key, r.name, u.rentalMode === "by_room" ? r.monthlyPrice : ""),
              type: "room" as const,
              rooms: [],
            }))
          : [],
    });
    return { id: `piso-${i}`, level: i + 1, outline: plan.outline, units: floor.units.map(unit) };
  });
  const s = formSummary(property.floors);
  return {
    id: "vista-previa",
    name: property.name || "Tu propiedad",
    businessId: "",
    coverPhotoPath: null,
    floors,
    summary: { floors: s.floors, apartments: s.apartments, rentable: s.rentable, occupied: 0 },
  };
}
