// Geometría de la planta, en metros. Funciones puras: reciben datos y devuelven un resultado.
// Convención: un rectángulo empieza en su esquina menor (x, z) y mide width en x y depth en z.
// La losa es un contorno de esquinas en orden, con bordes en ángulo recto (rectángulo, L, U…).

export type Point = { x: number; z: number };
export type Rect = { x: number; z: number; width: number; depth: number };

// Cuadrícula de 0.1 m. Se trabaja en décimas enteras para evitar errores de redondeo (0.1 + 0.2).
export const GRID = 0.1;
const toTenths = (v: number) => Math.round(v * 10);
export const snapToGrid = (v: number) => toTenths(v) / 10;
export const isOnGrid = (v: number) => Math.abs(v * 10 - toTenths(v)) < 1e-6;

export const rectOnGrid = (r: Rect) => [r.x, r.z, r.width, r.depth].every(isOnGrid);

type Segment = { a: Point; b: Point };

function edges(outline: Point[]): Segment[] {
  return outline.map((a, i) => ({ a, b: outline[(i + 1) % outline.length] }));
}

export type OutlineProblem =
  "too_few_corners" | "off_grid" | "not_right_angles" | "self_intersecting" | "no_area";

// Revisa que el contorno sea una losa válida. Devuelve el primer problema, o null si está bien.
export function outlineProblem(outline: Point[]): OutlineProblem | null {
  if (outline.length < 4) return "too_few_corners";
  if (!outline.every((p) => isOnGrid(p.x) && isOnGrid(p.z))) return "off_grid";

  const segs = edges(outline);
  for (const { a, b } of segs) {
    const vertical = a.x === b.x && a.z !== b.z;
    const horizontal = a.z === b.z && a.x !== b.x;
    if (!vertical && !horizontal) return "not_right_angles";
  }
  // Dos bordes seguidos en la misma dirección no forman esquina.
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i];
    const t = segs[(i + 1) % segs.length];
    if ((s.a.x === s.b.x) === (t.a.x === t.b.x)) return "not_right_angles";
  }
  // Bordes que no son vecinos no pueden tocarse.
  for (let i = 0; i < segs.length; i++) {
    for (let j = i + 1; j < segs.length; j++) {
      const neighbors = j === i + 1 || (i === 0 && j === segs.length - 1);
      if (!neighbors && segmentsTouch(segs[i], segs[j])) return "self_intersecting";
    }
  }
  if (outlineArea(outline) <= 0) return "no_area";
  return null;
}

function segmentsTouch(s: Segment, t: Segment): boolean {
  const sx = [Math.min(s.a.x, s.b.x), Math.max(s.a.x, s.b.x)];
  const sz = [Math.min(s.a.z, s.b.z), Math.max(s.a.z, s.b.z)];
  const tx = [Math.min(t.a.x, t.b.x), Math.max(t.a.x, t.b.x)];
  const tz = [Math.min(t.a.z, t.b.z), Math.max(t.a.z, t.b.z)];
  return sx[0] <= tx[1] && tx[0] <= sx[1] && sz[0] <= tz[1] && tz[0] <= sz[1];
}

// Área de la losa (fórmula del cordón de zapato), siempre positiva.
export function outlineArea(outline: Point[]): number {
  let twice = 0;
  for (const { a, b } of edges(outline)) twice += a.x * b.z - b.x * a.z;
  return Math.abs(twice) / 2;
}

// ¿El punto está estrictamente dentro de la losa? (rayo hacia +x que cuenta cruces)
function pointInside(p: Point, outline: Point[]): boolean {
  let inside = false;
  for (const { a, b } of edges(outline)) {
    if (a.x !== b.x) continue; // solo los bordes verticales cruzan un rayo horizontal
    const [z0, z1] = a.z < b.z ? [a.z, b.z] : [b.z, a.z];
    if (p.z > z0 && p.z <= z1 && a.x > p.x) inside = !inside;
  }
  return inside;
}

// ¿El rectángulo queda completo dentro de la losa? Tocar el borde está permitido.
// Basta con que su centro esté dentro y que ningún borde de la losa cruce su interior.
export function rectInsideOutline(r: Rect, outline: Point[]): boolean {
  const center = { x: r.x + r.width / 2, z: r.z + r.depth / 2 };
  if (!pointInside(center, outline)) return false;
  const x0 = r.x;
  const x1 = r.x + r.width;
  const z0 = r.z;
  const z1 = r.z + r.depth;
  for (const { a, b } of edges(outline)) {
    if (a.x === b.x) {
      const [lo, hi] = a.z < b.z ? [a.z, b.z] : [b.z, a.z];
      if (a.x > x0 && a.x < x1 && lo < z1 && hi > z0) return false;
    } else {
      const [lo, hi] = a.x < b.x ? [a.x, b.x] : [b.x, a.x];
      if (a.z > z0 && a.z < z1 && lo < x1 && hi > x0) return false;
    }
  }
  return true;
}

// ¿Dos rectángulos se solapan? Compartir un borde no es solaparse.
export function rectsOverlap(a: Rect, b: Rect): boolean {
  const eps = 1e-9;
  return (
    a.x < b.x + b.width - eps &&
    b.x < a.x + a.width - eps &&
    a.z < b.z + b.depth - eps &&
    b.z < a.z + a.depth - eps
  );
}

export function rectInsideRect(inner: Rect, outer: Rect): boolean {
  const eps = 1e-9;
  return (
    inner.x >= outer.x - eps &&
    inner.z >= outer.z - eps &&
    inner.x + inner.width <= outer.x + outer.width + eps &&
    inner.z + inner.depth <= outer.z + outer.depth + eps
  );
}

export function rectToOutline(r: Rect): Point[] {
  return [
    { x: r.x, z: r.z },
    { x: r.x + r.width, z: r.z },
    { x: r.x + r.width, z: r.z + r.depth },
    { x: r.x, z: r.z + r.depth },
  ];
}
