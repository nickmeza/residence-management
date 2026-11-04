// Ubicación automática de unidades para el modo simple, donde no se dibuja la planta.
// La forma de la losa y la posición exacta se ajustan después en el 3D (Fase 3).
import {
  rectInsideOutline,
  rectToOutline,
  rectsOverlap,
  snapToGrid,
  type Point,
  type Rect,
} from "./geometry";

export const DEFAULT_ROOM = { width: 3, depth: 3 };
export const DEFAULT_APARTMENT = { width: 6, depth: 5 };
// Ancho máximo de una fila antes de pasar a la siguiente.
const MAX_ROW_WIDTH = 12;

type Size = { width: number; depth: number };

// Tamaño a partir del área (m²): un cuadrado, redondeado a la cuadrícula. Sin área, el tamaño por defecto.
export function sizeFromArea(areaM2: number | null, fallback: Size): Size {
  if (!areaM2 || areaM2 <= 0) return fallback;
  const side = Math.max(1, snapToGrid(Math.sqrt(areaM2)));
  return { width: side, depth: side };
}

// Coloca rectángulos en filas, uno al lado del otro, empezando en (originX, originZ).
function packInRows(sizes: Size[], originX = 0, originZ = 0, maxRowWidth = MAX_ROW_WIDTH): Rect[] {
  const rects: Rect[] = [];
  let x = 0;
  let z = 0;
  let rowDepth = 0;
  for (const size of sizes) {
    if (x > 0 && x + size.width > maxRowWidth) {
      x = 0;
      z = snapToGrid(z + rowDepth);
      rowDepth = 0;
    }
    rects.push({ x: snapToGrid(originX + x), z: snapToGrid(originZ + z), ...size });
    x = snapToGrid(x + size.width);
    rowDepth = Math.max(rowDepth, size.depth);
  }
  return rects;
}

export type PlannedUnit = {
  key: string;
  type: "apartment" | "room";
  areaM2: number | null;
  // Solo departamentos: sus cuartos.
  rooms?: { key: string; areaM2: number | null }[];
};

export type PlannedFloor = { outline: Point[]; rects: Map<string, Rect> };

// Arma un piso nuevo: ubica las unidades en filas y crea una losa rectangular que las contiene.
// Los cuartos de un departamento quedan dentro del departamento, que crece si hace falta.
export function planFloor(units: PlannedUnit[]): PlannedFloor {
  const rects = new Map<string, Rect>();
  const sizes: Size[] = [];
  const innerLayouts: { key: string; rooms: { key: string; rect: Rect }[] }[] = [];

  for (const unit of units) {
    if (unit.type === "apartment" && unit.rooms?.length) {
      const roomSizes = unit.rooms.map((r) => sizeFromArea(r.areaM2, DEFAULT_ROOM));
      const inner = packInRows(roomSizes, 0, 0, Math.max(DEFAULT_APARTMENT.width, MAX_ROW_WIDTH / 2));
      const width = Math.max(DEFAULT_APARTMENT.width, ...inner.map((r) => snapToGrid(r.x + r.width)));
      const depth = Math.max(DEFAULT_APARTMENT.depth, ...inner.map((r) => snapToGrid(r.z + r.depth)));
      sizes.push({ width, depth });
      innerLayouts.push({ key: unit.key, rooms: unit.rooms.map((r, i) => ({ key: r.key, rect: inner[i] })) });
    } else {
      sizes.push(sizeFromArea(unit.areaM2, unit.type === "apartment" ? DEFAULT_APARTMENT : DEFAULT_ROOM));
    }
  }

  const placed = packInRows(sizes);
  units.forEach((unit, i) => rects.set(unit.key, placed[i]));
  for (const { key, rooms } of innerLayouts) {
    const parent = rects.get(key)!;
    for (const room of rooms) {
      rects.set(room.key, {
        ...room.rect,
        x: snapToGrid(parent.x + room.rect.x),
        z: snapToGrid(parent.z + room.rect.z),
      });
    }
  }

  const width = placed.length
    ? Math.max(...placed.map((r) => snapToGrid(r.x + r.width)))
    : DEFAULT_ROOM.width;
  const depth = placed.length
    ? Math.max(...placed.map((r) => snapToGrid(r.z + r.depth)))
    : DEFAULT_ROOM.depth;
  return { outline: rectToOutline({ x: 0, z: 0, width, depth }), rects };
}

// Busca un lugar libre para una unidad nueva dentro de un área (la losa o un departamento),
// recorriendo la cuadrícula. Devuelve null si no cabe.
export function findFreeSpot(size: Size, area: Point[] | Rect, occupied: Rect[], step = 0.5): Rect | null {
  const outline = Array.isArray(area) ? area : rectToOutline(area);
  const xs = outline.map((p) => p.x);
  const zs = outline.map((p) => p.z);
  const [minX, maxX, minZ, maxZ] = [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)];
  for (let z = minZ; z + size.depth <= maxZ + 1e-9; z = snapToGrid(z + step)) {
    for (let x = minX; x + size.width <= maxX + 1e-9; x = snapToGrid(x + step)) {
      const candidate = { x: snapToGrid(x), z: snapToGrid(z), ...size };
      if (rectInsideOutline(candidate, outline) && !occupied.some((o) => rectsOverlap(candidate, o))) {
        return candidate;
      }
    }
  }
  return null;
}
