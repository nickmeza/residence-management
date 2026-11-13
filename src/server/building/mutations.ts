import "server-only";

import { and, asc, eq, inArray, or, type SQL } from "drizzle-orm";

import type { db } from "@/db";
import { contract, floor, property, unit } from "@/db/schema";
import { isCoverPathOf } from "@/server/documents/files";

import {
  outlineForNewFloor,
  placeNewRoom,
  placeNewUnit,
  pricesAfterModeChange,
  sizeForNew,
  uniqueName,
} from "./edits";
import { outlineFromShape, shapeProblem, type SlabShape } from "./drag";
import { renumberFloors, reorderFloors } from "./floors";
import { snapToGrid, type Rect } from "./geometry";
import { floorProblems, type FloorProblem, type UnitInput } from "./rules";
import type { UnitEdit } from "./schemas";

// Cambios al edificio. Cada función recibe una transacción que ya corre como el usuario con sesión
// (withRls), así que el RLS decide qué puede tocar. Antes de guardar se revisan las reglas del piso;
// si algo no cumple, se lanza BuildingError con un mensaje para la pantalla y no se guarda nada.

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export class BuildingError extends Error {
  constructor(
    message: string,
    readonly field?: string,
  ) {
    super(message);
  }
}

const PROBLEM_MESSAGE: Record<FloorProblem["code"], { message: string; field?: string }> = {
  duplicate_name: { message: "Ya hay una unidad con ese nombre en el piso.", field: "name" },
  price_not_allowed: {
    message: "Esta unidad no se alquila sola: el precio va en lo que se alquila.",
    field: "monthlyPrice",
  },
  whole_floor_not_alone: {
    message: "Solo puede ocupar todo el piso si es la única unidad del piso.",
    field: "occupiesWholeFloor",
  },
  outside_slab: { message: "La unidad no cabe en la losa del piso." },
  outside_parent: { message: "El cuarto no cabe dentro de su departamento." },
  overlap: { message: "Dos unidades quedarían encimadas." },
  off_grid: { message: "La posición no está en la cuadrícula de 0.1 m." },
  parent_missing: { message: "El departamento de este cuarto no existe." },
  parent_not_apartment: { message: "Un cuarto solo puede estar dentro de un departamento." },
};

const NOT_FOUND = "No encontramos lo que quieres cambiar. Recarga la página.";

type UnitRow = typeof unit.$inferSelect;
const rectOf = (u: Pick<UnitRow, "posX" | "posZ" | "width" | "depth">): Rect => ({
  x: u.posX,
  z: u.posZ,
  width: u.width,
  depth: u.depth,
});
const toRule = (u: UnitRow): UnitInput => ({
  id: u.id,
  parentId: u.parentUnitId,
  type: u.type,
  name: u.name,
  rentalMode: u.rentalMode,
  occupiesWholeFloor: u.occupiesWholeFloor,
  monthlyPrice: u.monthlyPrice,
  ...rectOf(u),
});

async function loadFloor(tx: Tx, floorId: string) {
  const [f] = await tx.select().from(floor).where(eq(floor.id, floorId)).limit(1);
  if (!f) throw new BuildingError(NOT_FOUND);
  const units = await tx.select().from(unit).where(eq(unit.floorId, f.id));
  return { floor: f, units };
}

// Revisa las reglas del piso como quedaría después del cambio.
function assertValid(outline: (typeof floor.$inferSelect)["outline"], units: UnitInput[]) {
  const [first] = floorProblems(outline, units);
  if (first) {
    const { message, field } = PROBLEM_MESSAGE[first.code];
    throw new BuildingError(message, field);
  }
}

export async function addFloor(tx: Tx, propertyId: string) {
  const floors = await tx
    .select()
    .from(floor)
    .where(eq(floor.propertyId, propertyId))
    .orderBy(asc(floor.level));
  const top = floors.at(-1);
  await tx.insert(floor).values({
    propertyId,
    level: (top?.level ?? 0) + 1,
    outline: outlineForNewFloor(top?.outline),
  });
  return { propertyId };
}

export async function moveFloor(tx: Tx, floorId: string, direction: "up" | "down") {
  const [f] = await tx.select().from(floor).where(eq(floor.id, floorId)).limit(1);
  if (!f) throw new BuildingError(NOT_FOUND);
  const floors = await tx
    .select()
    .from(floor)
    .where(eq(floor.propertyId, f.propertyId))
    .orderBy(asc(floor.level));
  const from = floors.findIndex((x) => x.id === floorId);
  // "Subir" un piso es ponerlo un nivel más arriba (nivel mayor).
  const to = direction === "up" ? from + 1 : from - 1;
  if (to < 0 || to >= floors.length) return { propertyId: f.propertyId };
  for (const { id, level } of reorderFloors(floors, from, to)) {
    await tx.update(floor).set({ level }).where(eq(floor.id, id));
  }
  return { propertyId: f.propertyId };
}

// Una unidad con contratos (aunque ya hayan terminado) no se borra: se perdería con quién vivió ahí.
async function assertNoContracts(tx: Tx, where: SQL | undefined) {
  const [used] = await tx
    .select({ id: contract.id })
    .from(contract)
    .innerJoin(unit, eq(unit.id, contract.unitId))
    .where(where)
    .limit(1);
  if (used) throw new BuildingError("Tiene contratos registrados, así que no se puede quitar.");
}
export async function deleteFloor(tx: Tx, floorId: string) {
  await assertNoContracts(tx, eq(unit.floorId, floorId));
  const [f] = await tx.delete(floor).where(eq(floor.id, floorId)).returning({ propertyId: floor.propertyId });
  if (!f) throw new BuildingError(NOT_FOUND);
  const rest = await tx.select().from(floor).where(eq(floor.propertyId, f.propertyId));
  for (const { id, level } of renumberFloors(rest)) {
    await tx.update(floor).set({ level }).where(eq(floor.id, id));
  }
  return { propertyId: f.propertyId };
}

export async function addUnit(tx: Tx, floorId: string, type: "apartment" | "room") {
  const { floor: f, units } = await loadFloor(tx, floorId);
  const topLevel = units.filter((u) => !u.parentUnitId);
  const placed = placeNewUnit(f.outline, topLevel.map(rectOf), sizeForNew(type));
  if ("error" in placed) {
    throw new BuildingError("No hay espacio libre en la losa de este piso. Ajusta su forma en el 3D.");
  }
  const label = type === "apartment" ? "Departamento" : "Cuarto";
  const name = uniqueName(
    (n) => `${label} ${f.level}${String(n).padStart(2, "0")}`,
    units.map((u) => u.name),
    topLevel.length + 1,
  );
  // Con otra unidad en el piso, "ocupa todo el piso" deja de ser posible.
  const wasWhole = topLevel.filter((u) => u.occupiesWholeFloor).map((u) => u.id);

  const next = units.map((u) => ({
    ...toRule(u),
    occupiesWholeFloor: wasWhole.includes(u.id) ? false : u.occupiesWholeFloor,
  }));
  const draft: UnitInput = {
    id: "nuevo",
    parentId: null,
    type,
    name,
    rentalMode: type === "apartment" ? "whole" : null,
    occupiesWholeFloor: false,
    monthlyPrice: null,
    ...placed.rect,
  };
  assertValid(placed.outline, [...next, draft]);

  if (wasWhole.length)
    await tx.update(unit).set({ occupiesWholeFloor: false }).where(inArray(unit.id, wasWhole));
  if (placed.outline !== f.outline)
    await tx.update(floor).set({ outline: placed.outline }).where(eq(floor.id, f.id));
  await tx.insert(unit).values({
    floorId: f.id,
    type,
    name,
    rentalMode: draft.rentalMode,
    posX: placed.rect.x,
    posZ: placed.rect.z,
    width: placed.rect.width,
    depth: placed.rect.depth,
  });
  return { propertyId: f.propertyId };
}

export async function addRoom(tx: Tx, apartmentId: string) {
  const [apt] = await tx
    .select()
    .from(unit)
    .where(and(eq(unit.id, apartmentId), eq(unit.type, "apartment")))
    .limit(1);
  if (!apt) throw new BuildingError(NOT_FOUND);
  const { floor: f, units } = await loadFloor(tx, apt.floorId);
  const rooms = units.filter((u) => u.parentUnitId === apt.id);
  const others = units.filter((u) => !u.parentUnitId && u.id !== apt.id);
  const placed = placeNewRoom(
    f.outline,
    rectOf(apt),
    rooms.map(rectOf),
    others.map(rectOf),
    sizeForNew("room"),
  );
  if ("error" in placed) {
    throw new BuildingError("No hay espacio para otro cuarto en este departamento. Ajústalo en el 3D.");
  }
  const code = apt.name.match(/\d+$/)?.[0];
  const name = uniqueName(
    (n) => (code ? `Cuarto ${code}-${String.fromCharCode(64 + n)}` : `Dormitorio ${n}`),
    units.map((u) => u.name),
    rooms.length + 1,
  );

  const next = units.map((u) => (u.id === apt.id ? { ...toRule(u), ...placed.apartment } : toRule(u)));
  assertValid(placed.outline, [
    ...next,
    {
      id: "nuevo",
      parentId: apt.id,
      type: "room",
      name,
      rentalMode: null,
      occupiesWholeFloor: false,
      monthlyPrice: null,
      ...placed.rect,
    },
  ]);

  if (placed.outline !== f.outline)
    await tx.update(floor).set({ outline: placed.outline }).where(eq(floor.id, f.id));
  if (placed.apartment !== rectOf(apt)) {
    await tx
      .update(unit)
      .set({ width: placed.apartment.width, depth: placed.apartment.depth })
      .where(eq(unit.id, apt.id));
  }
  await tx.insert(unit).values({
    floorId: f.id,
    parentUnitId: apt.id,
    type: "room",
    name,
    posX: placed.rect.x,
    posZ: placed.rect.z,
    width: placed.rect.width,
    depth: placed.rect.depth,
  });
  return { propertyId: f.propertyId };
}

export async function updateUnit(tx: Tx, unitId: string, data: UnitEdit) {
  const [current] = await tx.select().from(unit).where(eq(unit.id, unitId)).limit(1);
  if (!current) throw new BuildingError(NOT_FOUND);
  const { floor: f, units } = await loadFloor(tx, current.floorId);
  const isApartment = current.type === "apartment";
  const mode = isApartment ? (data.rentalMode ?? current.rentalMode ?? "whole") : null;
  const modeChanged = isApartment && mode !== current.rentalMode;
  const prices = mode ? pricesAfterModeChange(mode) : null;

  const changes = {
    name: data.name,
    monthlyPrice: modeChanged && prices?.clearApartmentPrice ? null : data.monthlyPrice,
    areaM2: data.areaM2 === null ? null : String(data.areaM2),
    bathroom: data.bathroom,
    furnished: data.furnished,
    spaceType: data.spaceType,
    rentalMode: mode,
    occupiesWholeFloor: isApartment ? (data.occupiesWholeFloor ?? current.occupiesWholeFloor) : false,
  };
  const clearRoomIds =
    modeChanged && prices?.clearRoomPrices
      ? units.filter((u) => u.parentUnitId === current.id).map((u) => u.id)
      : [];

  assertValid(
    f.outline,
    units.map((u) => {
      if (u.id === current.id) return { ...toRule(u), ...changes };
      if (clearRoomIds.includes(u.id)) return { ...toRule(u), monthlyPrice: null };
      return toRule(u);
    }),
  );

  await tx.update(unit).set(changes).where(eq(unit.id, current.id));
  if (clearRoomIds.length)
    await tx.update(unit).set({ monthlyPrice: null }).where(inArray(unit.id, clearRoomIds));
  return { propertyId: f.propertyId };
}

export async function deleteUnit(tx: Tx, unitId: string) {
  await assertNoContracts(tx, or(eq(unit.id, unitId), eq(unit.parentUnitId, unitId)));
  // Al borrar un departamento, sus cuartos se borran con él (regla de la base: "on delete cascade").
  const [removed] = await tx.delete(unit).where(eq(unit.id, unitId)).returning({ floorId: unit.floorId });
  if (!removed) throw new BuildingError(NOT_FOUND);
  const [f] = await tx
    .select({ propertyId: floor.propertyId })
    .from(floor)
    .where(eq(floor.id, removed.floorId));
  return { propertyId: f.propertyId };
}

// Mueve una unidad en la planta (arrastre en el 3D). Un departamento arrastra a sus cuartos con él.
export async function moveUnit(tx: Tx, unitId: string, x: number, z: number) {
  const [current] = await tx.select().from(unit).where(eq(unit.id, unitId)).limit(1);
  if (!current) throw new BuildingError(NOT_FOUND);
  const { floor: f, units } = await loadFloor(tx, current.floorId);
  const dx = snapToGrid(snapToGrid(x) - current.posX);
  const dz = snapToGrid(snapToGrid(z) - current.posZ);
  const moves = (u: UnitRow) => u.id === current.id || u.parentUnitId === current.id;

  assertValid(
    f.outline,
    units.map((u) =>
      moves(u) ? { ...toRule(u), x: snapToGrid(u.posX + dx), z: snapToGrid(u.posZ + dz) } : toRule(u),
    ),
  );
  for (const u of units.filter(moves)) {
    await tx
      .update(unit)
      .set({ posX: snapToGrid(u.posX + dx), posZ: snapToGrid(u.posZ + dz) })
      .where(eq(unit.id, u.id));
  }
  return { propertyId: f.propertyId };
}

// Cambia la forma de la losa (rectángulo o L). No se permite si alguna unidad quedaría afuera.
export async function setFloorShape(tx: Tx, floorId: string, shape: SlabShape) {
  if (shapeProblem(shape)) throw new BuildingError("Revisa las medidas de la losa.");
  const { floor: f, units } = await loadFloor(tx, floorId);
  const outline = outlineFromShape(shape);
  try {
    assertValid(outline, units.map(toRule));
  } catch (e) {
    if (e instanceof BuildingError && e.message === PROBLEM_MESSAGE.outside_slab.message) {
      throw new BuildingError("Con esas medidas, alguna unidad quedaría fuera de la losa. Muévela primero.");
    }
    throw e;
  }
  await tx.update(floor).set({ outline }).where(eq(floor.id, f.id));
  return { propertyId: f.propertyId };
}

// Lleva un piso a otro nivel (arrastre de pisos en el 3D) y renumera los demás.
export async function moveFloorTo(tx: Tx, floorId: string, level: number) {
  const [f] = await tx.select().from(floor).where(eq(floor.id, floorId)).limit(1);
  if (!f) throw new BuildingError(NOT_FOUND);
  const floors = await tx
    .select()
    .from(floor)
    .where(eq(floor.propertyId, f.propertyId))
    .orderBy(asc(floor.level));
  const from = floors.findIndex((x) => x.id === floorId);
  const to = Math.min(Math.max(level - 1, 0), floors.length - 1);
  if (from === to) return { propertyId: f.propertyId };
  for (const { id, level: next } of reorderFloors(floors, from, to)) {
    await tx.update(floor).set({ level: next }).where(eq(floor.id, id));
  }
  return { propertyId: f.propertyId };
}

// Pone, cambia o quita (path = null) la foto de portada del edificio. Devuelve la foto anterior para borrarla
// del espacio privado. La ruta tiene que ser de la carpeta de portadas del negocio dueño del edificio.
export async function setCoverPhoto(tx: Tx, propertyId: string, path: string | null) {
  const [prop] = await tx
    .select({ businessId: property.businessId, old: property.coverPhotoPath })
    .from(property)
    .where(eq(property.id, propertyId))
    .limit(1);
  if (!prop) throw new BuildingError("No encontramos el edificio. Recarga la página.");
  if (path !== null && !isCoverPathOf(path, prop.businessId)) {
    throw new BuildingError("No pudimos guardar la foto. Vuelve a subirla.");
  }
  await tx.update(property).set({ coverPhotoPath: path }).where(eq(property.id, propertyId));
  return { propertyId, oldPath: prop.old !== path ? prop.old : null };
}
