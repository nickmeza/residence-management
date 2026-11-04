import { describe, expect, it } from "vitest";

import type { BuildingUnit, BuildingView } from "@/server/business/queries";

import { applyMove } from "./apply-move";

const unit = (id: string, x: number, rooms: BuildingUnit[] = []): BuildingUnit => ({
  id,
  name: id,
  type: rooms.length ? "apartment" : "room",
  rentalMode: rooms.length ? "whole" : null,
  occupiesWholeFloor: false,
  monthlyPrice: null,
  areaM2: null,
  bathroom: null,
  furnished: false,
  spaceType: null,
  rect: { x, z: 0, width: 3, depth: 3 },
  status: "available",
  rooms,
});

const building: BuildingView = {
  id: "p",
  name: "Edificio",
  businessId: "b",
  summary: { floors: 2, apartments: 1, rentable: 2, occupied: 0 },
  floors: [
    { id: "f1", level: 1, outline: [], units: [unit("a", 0), unit("d", 3, [unit("d1", 3)])] },
    { id: "f2", level: 2, outline: [], units: [] },
  ],
};

describe("cambios optimistas del 3D", () => {
  it("mover dos unidades seguidas conserva las dos (el error que se veía)", () => {
    const once = applyMove(building, { type: "unit", id: "a", x: 6, z: 1 });
    const twice = applyMove(once, { type: "unit", id: "d1", x: 4, z: 0 });
    expect(twice.floors[0].units[0].rect).toMatchObject({ x: 6, z: 1 });
    expect(twice.floors[0].units[1].rooms[0].rect).toMatchObject({ x: 4, z: 0 });
  });

  it("mover un departamento lleva a sus cuartos", () => {
    const moved = applyMove(building, { type: "unit", id: "d", x: 5, z: 2 });
    expect(moved.floors[0].units[1].rooms[0].rect).toMatchObject({ x: 5, z: 2 });
  });

  it("mover un piso cambia el orden y renumera", () => {
    const moved = applyMove(building, { type: "floor", id: "f1", level: 2 });
    expect(moved.floors.map((f) => [f.id, f.level])).toEqual([
      ["f2", 1],
      ["f1", 2],
    ]);
  });

  it("no cambia el original", () => {
    applyMove(building, { type: "unit", id: "a", x: 6, z: 1 });
    expect(building.floors[0].units[0].rect.x).toBe(0);
  });
});
