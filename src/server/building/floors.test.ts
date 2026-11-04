import { describe, expect, it } from "vitest";

import { floorName, renumberFloors, reorderFloors } from "./floors";

describe("pisos", () => {
  it("el nombre sale del nivel", () => {
    expect(floorName(2)).toBe("Piso 2");
  });

  it("al mover un piso, todos se renumeran solos", () => {
    const floors = [{ id: "a" }, { id: "b" }, { id: "c" }];
    expect(reorderFloors(floors, 2, 0)).toEqual([
      { id: "c", level: 1 },
      { id: "a", level: 2 },
      { id: "b", level: 3 },
    ]);
  });

  it("rechaza posiciones fuera de rango", () => {
    expect(() => reorderFloors([{ id: "a" }], 0, 3)).toThrow(RangeError);
  });

  it("después de borrar un piso, los niveles quedan seguidos", () => {
    expect(
      renumberFloors([
        { id: "c", level: 5 },
        { id: "a", level: 1 },
      ]),
    ).toEqual([
      { id: "a", level: 1 },
      { id: "c", level: 2 },
    ]);
  });
});
