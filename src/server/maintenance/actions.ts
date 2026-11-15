"use server";

import { revalidatePath } from "next/cache";

import { withRls } from "@/db/rls";
import { getSessionClaims } from "@/server/auth/session";
import { isUuid } from "@/server/business/queries";
import { issuesByPath } from "@/server/onboarding/schema";
import { fileExists } from "@/server/payments/storage";

import * as m from "./mutations";
import { commentSchema, landlordRequestSchema, requestUpdateSchema, residentRequestSchema } from "./schemas";

// Acciones de mantenimiento: validan con Zod, corren con la sesión (RLS) y vuelven a dibujar las pantallas.

export type MaintenanceResult =
  { ok: true; id?: string } | { ok: false; message: string; fieldErrors?: Record<string, string> };

type Tx = Parameters<Parameters<typeof withRls>[1]>[0];

const NOT_FOUND = "No encontramos ese pedido. Recarga la página.";

async function run(change: (tx: Tx, userId: string) => Promise<string | void>): Promise<MaintenanceResult> {
  const claims = await getSessionClaims();
  try {
    const id = await withRls(claims, (tx) => change(tx, claims.sub));
    revalidatePath("/mantenimiento", "layout");
    revalidatePath("/edificio", "layout");
    revalidatePath("/mi", "layout");
    return { ok: true, id: id ?? undefined };
  } catch (e) {
    if (e instanceof m.MaintenanceError) return { ok: false, message: e.message };
    console.error(e);
    return { ok: false, message: "No pudimos guardar el pedido. Vuelve a intentarlo." };
  }
}

const invalid = (error: Parameters<typeof issuesByPath>[0]): MaintenanceResult => ({
  ok: false,
  message: "Revisa los campos marcados.",
  fieldErrors: issuesByPath(error),
});

async function photoMissing(path: string | null) {
  return path !== null && !(await fileExists(path));
}

// El residente pide mantenimiento (MT-01).
export async function createMyRequestAction(input: unknown): Promise<MaintenanceResult> {
  const parsed = residentRequestSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  if (await photoMissing(parsed.data.photoPath)) {
    return { ok: false, message: "No encontramos la foto subida. Vuelve a subirla." };
  }
  return run((tx, userId) => m.createAsResident(tx, parsed.data, userId));
}

// El arrendador registra un pedido.
export async function createRequestAction(businessId: string, input: unknown): Promise<MaintenanceResult> {
  if (!isUuid(businessId)) return { ok: false, message: "No encontramos tu negocio. Recarga la página." };
  const parsed = landlordRequestSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  if (await photoMissing(parsed.data.photoPath)) {
    return { ok: false, message: "No encontramos la foto subida. Vuelve a subirla." };
  }
  return run((tx, userId) => m.createAsLandlord(tx, businessId, parsed.data, userId));
}

export async function updateRequestAction(id: string, input: unknown): Promise<MaintenanceResult> {
  if (!isUuid(id)) return { ok: false, message: NOT_FOUND };
  const parsed = requestUpdateSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  return run((tx) => m.updateRequest(tx, id, parsed.data));
}

// Comentario del arrendador o del residente.
export async function addCommentAction(id: string, input: unknown): Promise<MaintenanceResult> {
  if (!isUuid(id)) return { ok: false, message: NOT_FOUND };
  const parsed = commentSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  return run((tx, userId) => m.addComment(tx, id, parsed.data.body, userId));
}
