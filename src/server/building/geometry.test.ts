import { describe, expect, it } from "vitest";

import {
  isOnGrid,
  outlineArea,
  outlineProblem,
  rectInsideOutline,
  rectsOverlap,
  rectToOutline,
  snapToGrid,
  type Point,
} from "./geometry";

const square: Point[] = rectToOutline({ x: 0, z: 0, width: 10, depth: 8 });
// Losa en L: 6 de ancho abajo, 3 de ancho arriba. Falta la esquina de x 3..6, z 4..8.
const lShape: Point[] = [
  { x: 0, z: 0 },
  { x: 6, z: 0 },
  { x: 6, z: 4 },
  { x: 3, z: 4 },
  { x: 3, z: 8 },
  { x: 0, z: 8 },
];

describe("cuadrícula de 0.1 m", () => {
  it("redondea y reconoce valores en la cuadrícula, sin errores de decimales", () => {
    expect(snapToGrid(0.1 + 0.2)).toBe(0.3);
    expect(snapToGrid(2.46)).toBe(2.5);
    expect(isOnGrid(0.3)).toBe(true);
    expect(isOnGrid(0.35)).toBe(false);
  });
});

describe("contorno de la losa", () => {
  it("acepta un rectángulo y una L", () => {
    expect(outlineProblem(square)).toBeNull();
    expect(outlineProblem(lShape)).toBeNull();
  });

  it("calcula el área", () => {
    expect(outlineArea(square)).toBe(80);
    expect(outlineArea(lShape)).toBe(36);
  });

  it("rechaza menos de 4 esquinas, diagonales, puntos fuera de la cuadrícula y cruces", () => {
    expect(outlineProblem(square.slice(0, 3))).toBe("too_few_corners");
    expect(
      outlineProblem([
        { x: 0, z: 0 },
        { x: 4, z: 0 },
        { x: 5, z: 3 },
        { x: 0, z: 3 },
      ]),
    ).toBe("not_right_angles");
    expect(outlineProblem(rectToOutline({ x: 0, z: 0, width: 4.05, depth: 3 }))).toBe("off_grid");
    // Un borde atraviesa a otro: la losa se cruza consigo misma.
    const crossed = [
      [0, 0],
      [4, 0],
      [4, 3],
      [2, 3],
      [2, -1],
      [1, -1],
      [1, 1],
      [0, 1],
    ].map(([x, z]) => ({ x, z }));
    expect(outlineProblem(crossed)).toBe("self_intersecting");
  });
});

describe("cuarto dentro de la losa", () => {
  it("dentro del rectángulo, incluso tocando el borde", () => {
    expect(rectInsideOutline({ x: 0, z: 0, width: 3, depth: 3 }, square)).toBe(true);
    expect(rectInsideOutline({ x: 7, z: 5, width: 3, depth: 3 }, square)).toBe(true);
  });

  it("se sale del rectángulo", () => {
    expect(rectInsideOutline({ x: 8, z: 0, width: 3, depth: 3 }, square)).toBe(false);
    expect(rectInsideOutline({ x: -0.1, z: 0, width: 3, depth: 3 }, square)).toBe(false);
  });

  it("en la L: cabe en cada brazo, pero no en la esquina que falta", () => {
    expect(rectInsideOutline({ x: 3, z: 0, width: 3, depth: 4 }, lShape)).toBe(true);
    expect(rectInsideOutline({ x: 0, z: 4, width: 3, depth: 4 }, lShape)).toBe(true);
    expect(rectInsideOutline({ x: 4, z: 5, width: 2, depth: 2 }, lShape)).toBe(false);
    // Atraviesa el rincón de la L aunque su centro esté dentro.
    expect(rectInsideOutline({ x: 2, z: 3, width: 2, depth: 2 }, lShape)).toBe(false);
  });
});

describe("solapes", () => {
  it("compartir un borde no es solaparse", () => {
    expect(rectsOverlap({ x: 0, z: 0, width: 3, depth: 3 }, { x: 3, z: 0, width: 3, depth: 3 })).toBe(false);
  });

  it("detecta cuartos encimados", () => {
    expect(rectsOverlap({ x: 0, z: 0, width: 3, depth: 3 }, { x: 2.9, z: 0, width: 3, depth: 3 })).toBe(true);
  });
});
