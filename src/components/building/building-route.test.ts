import { describe, expect, it } from "vitest";

import type { BuildingUnit, BuildingView } from "@/server/business/queries";

import { hrefForView, parentHref, parseBuildingPath, sceneFor } from "./building-route";

const unit = (id: string, rooms: BuildingUnit[] = [], whole = false): BuildingUnit => ({
  id,
  name: id,
  type: rooms.length ? "apartment" : "room",
  rentalMode: rooms.length ? "by_room" : null,
  occupiesWholeFloor: whole,
  monthlyPrice: null,
  areaM2: null,
  bathroom: null,
  furnished: false,
  spaceType: null,
  rect: { x: 0, z: 0, width: 3, depth: 3 },
  status: "available",
  occupant: null,
  rooms,
});

// Piso 1: un cuarto suelto y un departamento. Piso 2: un departamento que ocupa todo el piso.
const building: BuildingView = {
  id: "p",
  name: "Edificio",
  businessId: "b",
  coverPhotoPath: null,
  summary: { floors: 2, apartments: 2, rentable: 3, occupied: 0 },
  floors: [
    { id: "f1", level: 1, outline: [], units: [unit("c101"), unit("d1", [unit("d1a")])] },
    { id: "f2", level: 2, outline: [], units: [unit("d2", [unit("d2a")], true)] },
  ],
};

describe("la dirección decide lo que muestra el 3D", () => {
  it("lee piso, unidad y pestaña de la dirección", () => {
    expect(parseBuildingPath("/edificio/p", null)).toEqual({});
    expect(parseBuildingPath("/edificio/p/piso/f1", null)).toEqual({ floorId: "f1", tab: undefined });
    expect(parseBuildingPath("/edificio/p/unidad/d1", "cuartos")).toEqual({ unitId: "d1", tab: "cuartos" });
  });

  it("un piso se ve por dentro; si un departamento lo ocupa todo, se entra directo a él", () => {
    expect(sceneFor(building, { floorId: "f1" }).view).toEqual({ level: "floor", floorId: "f1" });
    expect(sceneFor(building, { floorId: "f2" }).view).toEqual({ level: "unit", floorId: "f2", unitId: "d2" });
  });

  it("un cuarto suelto va marcado en su piso", () => {
    expect(sceneFor(building, { unitId: "c101" })).toEqual({
      view: { level: "floor", floorId: "f1" },
      selectedUnitId: "c101",
    });
  });

  it("un departamento va marcado en su piso, y en la pestaña Cuartos se ve por dentro", () => {
    expect(sceneFor(building, { unitId: "d1" }).selectedUnitId).toBe("d1");
    expect(sceneFor(building, { unitId: "d1", tab: "cuartos" }).view).toEqual({
      level: "unit",
      floorId: "f1",
      unitId: "d1",
    });
  });

  it("un cuarto de un departamento va marcado dentro del departamento", () => {
    expect(sceneFor(building, { unitId: "d1a" })).toEqual({
      view: { level: "unit", floorId: "f1", unitId: "d1" },
      selectedUnitId: "d1a",
    });
  });

  it("si la unidad o el piso ya no existen, se ve el edificio", () => {
    expect(sceneFor(building, { unitId: "x" }).view).toEqual({ level: "building" });
    expect(sceneFor(building, { floorId: "x" }).view).toEqual({ level: "building" });
  });
});

describe("entrar y volver en el 3D", () => {
  it("entrar a un departamento abre su pestaña Cuartos; al que ocupa todo el piso, el piso", () => {
    expect(hrefForView(building, { level: "floor", floorId: "f1" })).toBe("/edificio/p/piso/f1");
    expect(hrefForView(building, { level: "unit", floorId: "f1", unitId: "d1" })).toBe(
      "/edificio/p/unidad/d1?pestana=cuartos",
    );
    expect(hrefForView(building, { level: "unit", floorId: "f2", unitId: "d2" })).toBe("/edificio/p/piso/f2");
  });

  it("volver sube un nivel sin repetir el departamento que es el piso", () => {
    expect(parentHref(building, {})).toBeNull();
    expect(parentHref(building, { floorId: "f1" })).toBe("/edificio/p");
    expect(parentHref(building, { unitId: "c101" })).toBe("/edificio/p/piso/f1");
    expect(parentHref(building, { unitId: "d1a" })).toBe("/edificio/p/unidad/d1?pestana=cuartos");
    expect(parentHref(building, { unitId: "d2a" })).toBe("/edificio/p/piso/f2?pestana=cuartos");
    expect(parentHref(building, { unitId: "d2" })).toBe("/edificio/p");
  });
});
