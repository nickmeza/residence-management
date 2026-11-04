import { describe, expect, it } from "vitest";

import { floorProblems, type UnitInput } from "@/server/building/rules";
import { newRoom, newUnit, type SetupForm } from "@/server/onboarding/form";

import { previewBuilding } from "./preview-building";

const property = (floors: SetupForm["property"]["floors"]): SetupForm["property"] => ({
  type: "building",
  ownerLivesHere: "no",
  name: "Edificio de prueba",
  address: "",
  districtCity: "",
  floors,
});

describe("vista previa 3D del registro", () => {
  it("arma pisos y unidades con la misma ubicación automática que el servidor", () => {
    const apt = {
      ...newUnit("apartment", 2, 0),
      rentalMode: "by_room" as const,
      rooms: [newRoom("Departamento 201", 0), newRoom("Departamento 201", 1)],
    };
    const preview = previewBuilding(
      property([{ units: [newUnit("room", 1, 0)] }, { units: [apt, newUnit("room", 2, 1)] }]),
    );

    expect(preview.floors.map((f) => f.level)).toEqual([1, 2]);
    expect(preview.summary).toMatchObject({ floors: 2, apartments: 1, rentable: 4 });

    // Todo queda dentro de su losa y sin encimarse.
    for (const f of preview.floors) {
      const units: UnitInput[] = f.units.flatMap((u) => [
        {
          id: u.id,
          parentId: null,
          type: u.type,
          name: u.name,
          rentalMode: u.rentalMode,
          occupiesWholeFloor: u.occupiesWholeFloor,
          monthlyPrice: null,
          ...u.rect,
        },
        ...u.rooms.map((r) => ({
          id: r.id,
          parentId: u.id,
          type: "room" as const,
          name: r.name,
          rentalMode: null,
          occupiesWholeFloor: false,
          monthlyPrice: null,
          ...r.rect,
        })),
      ]);
      expect(floorProblems(f.outline, units)).toEqual([]);
    }
  });

  it("muestra el precio solo donde se alquila", () => {
    const apt = {
      ...newUnit("apartment", 1, 0),
      monthlyPrice: "1500",
      rooms: [{ ...newRoom("Departamento 101", 0), monthlyPrice: "500" }],
    };
    const [unit] = previewBuilding(property([{ units: [apt] }])).floors[0].units;
    expect(unit.monthlyPrice).toBe("1500");
    expect(unit.rooms[0].monthlyPrice).toBeNull();
  });
});
