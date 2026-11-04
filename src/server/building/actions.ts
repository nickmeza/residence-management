"use server";

import { revalidatePath } from "next/cache";

import { withRls } from "@/db/rls";
import { getSessionClaims } from "@/server/auth/session";
import { isUuid } from "@/server/business/queries";
import { issuesByPath } from "@/server/onboarding/schema";

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
    revalidatePath(`/edificio/${propertyId}`);
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
