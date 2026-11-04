import { describe, expect, it } from "vitest";

import { rectInsideOutline, rectToOutline } from "./geometry";
import { findFreeSpot, planFloor, sizeFromArea } from "./layout";
import { floorProblems, type UnitInput } from "./rules";

describe("tamaño desde el área", () => {
  it("un cuarto de 12 m² mide unos 3.5 × 3.5", () => {
    expect(sizeFromArea(12, { width: 3, depth: 3 })).toEqual({ width: 3.5, depth: 3.5 });
  });

  it("sin área usa el tamaño por defecto", () => {
    expect(sizeFromArea(null, { width: 3, depth: 3 })).toEqual({ width: 3, depth: 3 });
  });
});

describe("armar un piso automáticamente", () => {
  it("ubica departamento y cuartos sin solapes, dentro de la losa y de su departamento", () => {
    const plan = planFloor([
      {
        key: "301",
        type: "apartment",
        areaM2: null,
        rooms: [1, 2, 3].map((n) => ({ key: `301-${n}`, areaM2: null })),
      },
      { key: "302", type: "room", areaM2: 12 },
      { key: "303", type: "room", areaM2: null },
    ]);

    const units: UnitInput[] = [...plan.rects.entries()].map(([key, rect]) => ({
      ...rect,
      id: key,
      parentId: key.startsWith("301-") ? "301" : null,
      type: key === "301" ? "apartment" : "room",
      name: key,
      rentalMode: key === "301" ? "by_room" : null,
      occupiesWholeFloor: false,
      monthlyPrice: null,
    }));

    expect(floorProblems(plan.outline, units)).toEqual([]);
  });

  it("un piso con muchos cuartos pasa a una segunda fila", () => {
    const plan = planFloor(
      Array.from({ length: 6 }, (_, i) => ({ key: `c${i}`, type: "room" as const, areaM2: null })),
    );
    const zs = new Set([...plan.rects.values()].map((r) => r.z));
    expect(zs.size).toBe(2);
  });
});

describe("lugar libre para una unidad nueva", () => {
  const lShape = [
    { x: 0, z: 0 },
    { x: 6, z: 0 },
    { x: 6, z: 4 },
    { x: 3, z: 4 },
    { x: 3, z: 8 },
    { x: 0, z: 8 },
  ];

  it("encuentra un hueco que no choca con lo que ya hay, también en una L", () => {
    const occupied = [{ x: 0, z: 0, width: 6, depth: 4 }];
    const spot = findFreeSpot({ width: 3, depth: 3 }, lShape, occupied);
    expect(spot).not.toBeNull();
    expect(rectInsideOutline(spot!, lShape)).toBe(true);
    expect(spot!.z).toBeGreaterThanOrEqual(4);
  });

  it("devuelve null si no cabe", () => {
    const full = [{ x: 0, z: 0, width: 4, depth: 4 }];
    expect(
      findFreeSpot({ width: 3, depth: 3 }, rectToOutline({ x: 0, z: 0, width: 4, depth: 4 }), full),
    ).toBeNull();
  });
});
