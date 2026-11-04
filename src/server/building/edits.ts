// Cambios sobre un edificio que ya existe (pantalla Edificio, modo simple). Funciones puras:
// reciben el estado actual y devuelven qué hay que guardar, o por qué no se puede.
import {
  rectToOutline,
  rectsOverlap,
  rectInsideOutline,
  snapToGrid,
  type Point,
  type Rect,
} from "./geometry";
import { DEFAULT_APARTMENT, DEFAULT_ROOM, findFreeSpot, sizeFromArea } from "./layout";

type Size = { width: number; depth: number };

// Un contorno de 4 esquinas es un rectángulo: se puede agrandar solo. Una L o una U se ajustan a mano en el 3D.
export const isRectangle = (outline: Point[]) => outline.length === 4;

function bounds(outline: Point[]) {
  const xs = outline.map((p) => p.x);
  const zs = outline.map((p) => p.z);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs) };
}

export type Placement = { rect: Rect; outline: Point[] } | { error: "no_space" };

// Lugar para una unidad suelta nueva: un hueco libre en la losa. Si no hay y la losa es rectangular,
// la losa crece hacia la derecha para hacerle espacio.
export function placeNewUnit(outline: Point[], topLevel: Rect[], size: Size): Placement {
  const spot = findFreeSpot(size, outline, topLevel);
  if (spot) return { rect: spot, outline };
  if (!isRectangle(outline)) return { error: "no_space" };
  const b = bounds(outline);
  const rect = { x: b.maxX, z: b.minZ, ...size };
  const grown = rectToOutline({
    x: b.minX,
    z: b.minZ,
    width: snapToGrid(b.maxX - b.minX + size.width),
    depth: Math.max(snapToGrid(b.maxZ - b.minZ), size.depth),
  });
  return { rect, outline: grown };
}

export type RoomPlacement = { rect: Rect; apartment: Rect; outline: Point[] } | { error: "no_space" };

// Lugar para un cuarto nuevo dentro de un departamento. Si no cabe, el departamento se agranda hacia la
// derecha, siempre que no choque con otra unidad; la losa crece si es rectangular.
export function placeNewRoom(
  outline: Point[],
  apartment: Rect,
  rooms: Rect[],
  otherTopLevel: Rect[],
  size: Size,
): RoomPlacement {
  const spot = findFreeSpot(size, apartment, rooms);
  if (spot) return { rect: spot, apartment, outline };

  const grownApartment = {
    ...apartment,
    width: snapToGrid(apartment.width + size.width),
    depth: Math.max(apartment.depth, size.depth),
  };
  if (otherTopLevel.some((o) => rectsOverlap(grownApartment, o))) return { error: "no_space" };

  let nextOutline = outline;
  if (!rectInsideOutline(grownApartment, outline)) {
    if (!isRectangle(outline)) return { error: "no_space" };
    const b = bounds(outline);
    nextOutline = rectToOutline({
      x: b.minX,
      z: b.minZ,
      width: Math.max(
        snapToGrid(b.maxX - b.minX),
        snapToGrid(grownApartment.x + grownApartment.width - b.minX),
      ),
      depth: Math.max(
        snapToGrid(b.maxZ - b.minZ),
        snapToGrid(grownApartment.z + grownApartment.depth - b.minZ),
      ),
    });
  }
  const rect = { x: snapToGrid(apartment.x + apartment.width), z: apartment.z, ...size };
  return { rect, apartment: grownApartment, outline: nextOutline };
}

export const sizeForNew = (type: "apartment" | "room", areaM2: number | null = null) =>
  sizeFromArea(areaM2, type === "apartment" ? DEFAULT_APARTMENT : DEFAULT_ROOM);

// Nombre sugerido que no se repita en el piso: "Cuarto 203", y si ya existe, "Cuarto 204"…
export function uniqueName(base: (n: number) => string, taken: string[], start: number) {
  const used = new Set(taken.map((t) => t.trim().toLowerCase()));
  for (let n = start; n < start + 500; n++) {
    const name = base(n);
    if (!used.has(name.toLowerCase())) return name;
  }
  return base(Date.now());
}

// Losa para un piso nuevo: la misma forma que el piso de abajo (lo normal en un edificio) o un rectángulo.
export function outlineForNewFloor(floorBelow: Point[] | undefined): Point[] {
  return (
    floorBelow ??
    rectToOutline({ x: 0, z: 0, width: DEFAULT_APARTMENT.width, depth: DEFAULT_APARTMENT.depth })
  );
}

// Al cambiar cómo se alquila un departamento, el precio pasa de un lado al otro (el precio vive en lo que
// se alquila): por cuartos → sin precio en el departamento; completo → sin precio en sus cuartos.
export function pricesAfterModeChange(mode: "whole" | "by_room") {
  return mode === "by_room"
    ? { clearApartmentPrice: true, clearRoomPrices: false }
    : { clearApartmentPrice: false, clearRoomPrices: true };
}
