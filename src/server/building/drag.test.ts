import { describe, expect, it } from "vitest";

import { dragTo, isValidSpot, outlineFromShape, shapeFromOutline, shapeProblem } from "./drag";
import { outlineArea, rectToOutline } from "./geometry";

const slab = { outline: rectToOutline({ x: 0, z: 0, width: 10, depth: 8 }) };
const room = { x: 0, z: 0, width: 3, depth: 3 };

describe("arrastrar una unidad en la planta", () => {
  it("se ajusta a la cuadrícula de 0.1 m", () => {
    expect(dragTo(room, 2.234, 1.06, slab, [])).toEqual({ ...room, x: 2.2, z: 1.1 });
  });

  it("no se sale de la losa", () => {
    expect(dragTo(room, 9, -2, slab, [])).toEqual({ ...room, x: 7, z: 0 });
  });

  it("si choca, se desliza por el borde de la otra unidad", () => {
    const other = { x: 4, z: 0, width: 3, depth: 3 };
    // Quiere ir a (2, 2): moverse en x lo hace chocar; en z no, así que solo baja.
    expect(dragTo(room, 2, 2, slab, [other])).toEqual({ ...room, x: 0, z: 2 });
  });

  it("si no puede moverse, se queda donde estaba", () => {
    const walls = [
      { x: 3, z: 0, width: 3, depth: 8 },
      { x: 0, z: 3, width: 3, depth: 5 },
    ];
    expect(dragTo(room, 4, 4, slab, walls)).toEqual(room);
  });

  it("en una L no entra en la esquina que falta", () => {
    const l = { outline: outlineFromShape({ kind: "L", width: 6, depth: 8, cutWidth: 3, cutDepth: 4 }) };
    const moved = dragTo(room, 3, 5, l, []);
    expect(isValidSpot(moved, l, [])).toBe(true);
    expect(moved.x + moved.width <= 3 || moved.z + moved.depth <= 4).toBe(true);
  });

  it("un cuarto interior no sale de su departamento", () => {
    const parent = { parent: { x: 2, z: 2, width: 6, depth: 4 } };
    expect(dragTo({ x: 2, z: 2, width: 3, depth: 2 }, 0, 9, parent, [])).toEqual({
      x: 2,
      z: 4,
      width: 3,
      depth: 2,
    });
  });
});

describe("forma de la losa", () => {
  it("rectángulo y L, con sus áreas", () => {
    expect(outlineArea(outlineFromShape({ kind: "rect", width: 10, depth: 8 }))).toBe(80);
    expect(outlineArea(outlineFromShape({ kind: "L", width: 6, depth: 8, cutWidth: 3, cutDepth: 4 }))).toBe(
      36,
    );
  });

  it("reconoce la forma de un contorno guardado", () => {
    const l = { kind: "L" as const, width: 6, depth: 8, cutWidth: 3, cutDepth: 4 };
    expect(shapeFromOutline(outlineFromShape(l))).toEqual(l);
    expect(shapeFromOutline(rectToOutline({ x: 0, z: 0, width: 5, depth: 4 }))).toEqual({
      kind: "rect",
      width: 5,
      depth: 4,
    });
  });

  it("rechaza losas muy chicas o con un corte más grande que la losa", () => {
    expect(shapeProblem({ kind: "rect", width: 0.5, depth: 4 })).toBe("too_small");
    expect(shapeProblem({ kind: "L", width: 6, depth: 8, cutWidth: 6, cutDepth: 4 })).toBe("cut_too_big");
    expect(shapeProblem({ kind: "L", width: 6, depth: 8, cutWidth: 3, cutDepth: 4 })).toBeNull();
  });
});
