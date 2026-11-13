"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { withRls } from "@/db/rls";
import { getSessionClaims } from "@/server/auth/session";
import { isUuid } from "@/server/business/queries";
import { issuesByPath } from "@/server/onboarding/schema";
import { fileExists } from "@/server/payments/storage";

import { removeCover } from "./cover";
import * as m from "./mutations";
import { unitEditSchema } from "./schemas";

// Acciones de la pantalla Edificio. Cada una: valida, corre con la sesión (RLS), guarda en una
// transacción y vuelve a dibujar la pantalla con los datos nuevos.

export type BuildingResult =
  { ok: true } | { ok: false; message: string; fieldErrors?: Record<string, string> };

async function run(
  ids: string[],
  change: Parameters<typeof withRls<{ propertyId: string }>>[1],
): Promise<BuildingResult> {
  if (!ids.every(isUuid))
    return { ok: false, message: "No encontramos lo que quieres cambiar. Recarga la página." };
  const claims = await getSessionClaims();
  try {
    const { propertyId } = await withRls(claims, change);
    // "layout": también las páginas de cada piso y unidad.
    revalidatePath(`/edificio/${propertyId}`, "layout");
    return { ok: true };
  } catch (e) {
    if (e instanceof m.BuildingError) {
      return { ok: false, message: e.message, fieldErrors: e.field ? { [e.field]: e.message } : undefined };
    }
    console.error(e);
    return { ok: false, message: "No pudimos guardar el cambio. Vuelve a intentarlo." };
  }
}

export async function addFloorAction(propertyId: string) {
  return run([propertyId], (tx) => m.addFloor(tx, propertyId));
}

export async function moveFloorAction(floorId: string, direction: "up" | "down") {
  return run([floorId], (tx) => m.moveFloor(tx, floorId, direction));
}

export async function deleteFloorAction(floorId: string) {
  return run([floorId], (tx) => m.deleteFloor(tx, floorId));
}

export async function addUnitAction(floorId: string, type: "apartment" | "room") {
  return run([floorId], (tx) => m.addUnit(tx, floorId, type));
}

export async function addRoomAction(apartmentId: string) {
  return run([apartmentId], (tx) => m.addRoom(tx, apartmentId));
}

export async function updateUnitAction(unitId: string, input: unknown): Promise<BuildingResult> {
  const parsed = unitEditSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Revisa los campos marcados.", fieldErrors: issuesByPath(parsed.error) };
  }
  return run([unitId], (tx) => m.updateUnit(tx, unitId, parsed.data));
}

export async function deleteUnitAction(unitId: string) {
  return run([unitId], (tx) => m.deleteUnit(tx, unitId));
}

// Acciones del 3D: arrastrar una unidad, cambiar la forma de la losa y arrastrar un piso a otro nivel.
const coordinate = z.number().finite().min(-1000).max(1000);
const slabShapeSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("rect"),
    width: z.number().positive().max(200),
    depth: z.number().positive().max(200),
  }),
  z.object({
    kind: z.literal("L"),
    width: z.number().positive().max(200),
    depth: z.number().positive().max(200),
    cutWidth: z.number().positive().max(200),
    cutDepth: z.number().positive().max(200),
  }),
]);

export async function moveUnitAction(unitId: string, posX: number, posZ: number) {
  const parsed = z.object({ x: coordinate, z: coordinate }).safeParse({ x: posX, z: posZ });
  if (!parsed.success) return { ok: false as const, message: "La posición no es válida." };
  return run([unitId], (tx) => m.moveUnit(tx, unitId, parsed.data.x, parsed.data.z));
}

export async function setFloorShapeAction(floorId: string, shape: unknown) {
  const parsed = slabShapeSchema.safeParse(shape);
  if (!parsed.success) return { ok: false as const, message: "Revisa las medidas de la losa." };
  return run([floorId], (tx) => m.setFloorShape(tx, floorId, parsed.data));
}

// Foto de portada: el navegador ya la subió al espacio privado; aquí se revisa que exista y se guarda la ruta.
// null = quitar la foto. La foto anterior se borra del espacio privado.
export async function setCoverPhotoAction(propertyId: string, path: string | null): Promise<BuildingResult> {
  const parsed = z.string().max(200).nullable().safeParse(path);
  if (!parsed.success || !isUuid(propertyId)) {
    return { ok: false, message: "No encontramos lo que quieres cambiar. Recarga la página." };
  }
  if (parsed.data !== null && !(await fileExists(parsed.data))) {
    return { ok: false, message: "No encontramos la foto subida. Vuelve a intentarlo." };
  }
  const claims = await getSessionClaims();
  try {
    const { oldPath } = await withRls(claims, (tx) => m.setCoverPhoto(tx, propertyId, parsed.data));
    if (oldPath) await removeCover(oldPath);
    revalidatePath(`/edificio/${propertyId}`, "layout");
    revalidatePath("/mi");
    return { ok: true };
  } catch (e) {
    if (parsed.data !== null) await removeCover(parsed.data);
    if (e instanceof m.BuildingError) return { ok: false, message: e.message };
    console.error(e);
    return { ok: false, message: "No pudimos guardar la foto. Vuelve a intentarlo." };
  }
}

export async function moveFloorToAction(floorId: string, level: number) {
  if (!Number.isInteger(level) || level < 1) return { ok: false as const, message: "Ese nivel no existe." };
  return run([floorId], (tx) => m.moveFloorTo(tx, floorId, level));
}
