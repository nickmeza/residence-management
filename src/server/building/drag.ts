// Arrastre en la planta del 3D y forma de la losa. Funciones puras: el 3D las usa para que la unidad
// se mueva bien mientras arrastras, y el servidor vuelve a revisar todo antes de guardar.
import {
  outlineProblem,
  rectInsideOutline,
  rectInsideRect,
  rectsOverlap,
  rectToOutline,
  snapToGrid,
  type Point,
  type Rect,
} from "./geometry";

// Dónde puede moverse una unidad: una unidad suelta, dentro de la losa; un cuarto interior, dentro de su departamento.
export type DragArea = { outline: Point[] } | { parent: Rect };

const insideArea = (r: Rect, area: DragArea) =>
  "outline" in area ? rectInsideOutline(r, area.outline) : rectInsideRect(r, area.parent);

function areaBounds(area: DragArea) {
  if ("parent" in area) {
    const p = area.parent;
    return { minX: p.x, maxX: p.x + p.width, minZ: p.z, maxZ: p.z + p.depth };
  }
  const xs = area.outline.map((p) => p.x);
  const zs = area.outline.map((p) => p.z);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs) };
}

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.max(lo, hi));

export const isValidSpot = (r: Rect, area: DragArea, others: Rect[]) =>
  insideArea(r, area) && !others.some((o) => rectsOverlap(r, o));

// Siguiente posición al arrastrar hacia (x, z): se ajusta a la cuadrícula de 0.1 m y no se sale del área.
// Si choca con otra unidad, intenta moverse solo en x o solo en z (se "desliza" por el borde, como el
// prototipo); si tampoco puede, se queda donde estaba.
export function dragTo(current: Rect, x: number, z: number, area: DragArea, others: Rect[]): Rect {
  const b = areaBounds(area);
  const nx = snapToGrid(clamp(x, b.minX, b.maxX - current.width));
  const nz = snapToGrid(clamp(z, b.minZ, b.maxZ - current.depth));
  for (const candidate of [
    { ...current, x: nx, z: nz },
    { ...current, x: nx },
    { ...current, z: nz },
  ]) {
    if (isValidSpot(candidate, area, others)) return candidate;
  }
  return current;
}

// Forma de la losa que se puede elegir en el 3D: un rectángulo o una L (un rectángulo al que le falta
// una esquina). Las medidas van en metros.
export type SlabShape =
  | { kind: "rect"; width: number; depth: number }
  | { kind: "L"; width: number; depth: number; cutWidth: number; cutDepth: number };

export function outlineFromShape(shape: SlabShape): Point[] {
  const w = snapToGrid(shape.width);
  const d = snapToGrid(shape.depth);
  if (shape.kind === "rect") return rectToOutline({ x: 0, z: 0, width: w, depth: d });
  // Falta la esquina de arriba a la derecha: de (w - cutWidth, d - cutDepth) a (w, d).
  const cx = snapToGrid(w - shape.cutWidth);
  const cz = snapToGrid(d - shape.cutDepth);
  return [
    { x: 0, z: 0 },
    { x: w, z: 0 },
    { x: w, z: cz },
    { x: cx, z: cz },
    { x: cx, z: d },
    { x: 0, z: d },
  ];
}

// Lo contrario: qué forma es un contorno, para mostrar sus medidas en el formulario. null si es otra forma.
export function shapeFromOutline(outline: Point[]): SlabShape | null {
  const xs = outline.map((p) => p.x);
  const zs = outline.map((p) => p.z);
  const width = Math.max(...xs) - Math.min(...xs);
  const depth = Math.max(...zs) - Math.min(...zs);
  if (outline.length === 4) return { kind: "rect", width, depth };
  if (outline.length === 6) {
    const guess = outline[3];
    const shape: SlabShape = {
      kind: "L",
      width,
      depth,
      cutWidth: snapToGrid(width - guess.x),
      cutDepth: snapToGrid(depth - guess.z),
    };
    const same = outlineFromShape(shape).every((p, i) => p.x === outline[i].x && p.z === outline[i].z);
    if (same) return shape;
  }
  return null;
}

export type ShapeProblem = "too_small" | "cut_too_big" | "invalid";

export function shapeProblem(shape: SlabShape): ShapeProblem | null {
  if (shape.width < 1 || shape.depth < 1) return "too_small";
  if (
    shape.kind === "L" &&
    (shape.cutWidth <= 0 ||
      shape.cutDepth <= 0 ||
      shape.cutWidth >= shape.width ||
      shape.cutDepth >= shape.depth)
  ) {
    return "cut_too_big";
  }
  return outlineProblem(outlineFromShape(shape)) ? "invalid" : null;
}
