import { describe, expect, it } from "vitest";

import {
  outlineForNewFloor,
  placeNewRoom,
  placeNewUnit,
  pricesAfterModeChange,
  sizeForNew,
  uniqueName,
} from "./edits";
import { rectInsideOutline, rectsOverlap, rectToOutline } from "./geometry";

const slab = rectToOutline({ x: 0, z: 0, width: 9, depth: 3 });
const lShape = [
  { x: 0, z: 0 },
  { x: 6, z: 0 },
  { x: 6, z: 4 },
  { x: 3, z: 4 },
  { x: 3, z: 8 },
  { x: 0, z: 8 },
];

describe("ubicar una unidad nueva", () => {
  it("usa un hueco libre de la losa", () => {
    const placed = placeNewUnit(slab, [{ x: 0, z: 0, width: 3, depth: 3 }], { width: 3, depth: 3 });
    expect("rect" in placed && placed.rect.x).toBe(3);
    expect("outline" in placed && placed.outline).toBe(slab);
  });

  it("si no cabe y la losa es rectangular, la losa crece hacia la derecha", () => {
    const full = [
      { x: 0, z: 0, width: 3, depth: 3 },
      { x: 3, z: 0, width: 3, depth: 3 },
      { x: 6, z: 0, width: 3, depth: 3 },
    ];
    const placed = placeNewUnit(slab, full, { width: 3, depth: 3 });
    if (!("rect" in placed)) throw new Error("debía ubicarse");
    expect(placed.rect).toEqual({ x: 9, z: 0, width: 3, depth: 3 });
    expect(rectInsideOutline(placed.rect, placed.outline)).toBe(true);
    expect(full.some((r) => rectsOverlap(r, placed.rect))).toBe(false);
  });

  it("en una L llena no inventa espacio: hay que ajustarla en el 3D", () => {
    const full = [
      { x: 0, z: 0, width: 6, depth: 4 },
      { x: 0, z: 4, width: 3, depth: 4 },
    ];
    expect(placeNewUnit(lShape, full, { width: 3, depth: 3 })).toEqual({ error: "no_space" });
  });
});

describe("ubicar un cuarto nuevo dentro de un departamento", () => {
  const apartment = { x: 0, z: 0, width: 6, depth: 3 };

  it("usa el espacio libre del departamento", () => {
    const placed = placeNewRoom(slab, apartment, [{ x: 0, z: 0, width: 3, depth: 3 }], [], {
      width: 3,
      depth: 3,
    });
    expect("rect" in placed && placed.rect.x).toBe(3);
  });

  it("si está lleno, el departamento se agranda (y la losa si hace falta)", () => {
    const rooms = [
      { x: 0, z: 0, width: 3, depth: 3 },
      { x: 3, z: 0, width: 3, depth: 3 },
    ];
    const placed = placeNewRoom(rectToOutline(apartment), apartment, rooms, [], { width: 3, depth: 3 });
    if (!("rect" in placed)) throw new Error("debía ubicarse");
    expect(placed.apartment.width).toBe(9);
    expect(rectInsideOutline(placed.apartment, placed.outline)).toBe(true);
  });

  it("no se agranda encima de otra unidad", () => {
    const rooms = [
      { x: 0, z: 0, width: 3, depth: 3 },
      { x: 3, z: 0, width: 3, depth: 3 },
    ];
    const neighbor = [{ x: 6, z: 0, width: 3, depth: 3 }];
    expect(placeNewRoom(slab, apartment, rooms, neighbor, { width: 3, depth: 3 })).toEqual({
      error: "no_space",
    });
  });
});

describe("nombres, pisos nuevos y precios", () => {
  it("sugiere un nombre que no se repite en el piso", () => {
    expect(uniqueName((n) => `Cuarto 2${String(n).padStart(2, "0")}`, ["Cuarto 201", "cuarto 202"], 1)).toBe(
      "Cuarto 203",
    );
  });

  it("un piso nuevo copia la losa del piso de abajo", () => {
    expect(outlineForNewFloor(lShape)).toBe(lShape);
    expect(outlineForNewFloor(undefined)).toHaveLength(4);
  });

  it("el tamaño por defecto depende del tipo y del área", () => {
    expect(sizeForNew("room")).toEqual({ width: 3, depth: 3 });
    expect(sizeForNew("apartment")).toEqual({ width: 6, depth: 5 });
    expect(sizeForNew("room", 16)).toEqual({ width: 4, depth: 4 });
  });

  it("al cambiar el modo de alquiler, el precio pasa al lado que se alquila", () => {
    expect(pricesAfterModeChange("by_room")).toEqual({ clearApartmentPrice: true, clearRoomPrices: false });
    expect(pricesAfterModeChange("whole")).toEqual({ clearApartmentPrice: false, clearRoomPrices: true });
  });
});
