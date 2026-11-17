"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { withRls } from "@/db/rls";
import { business, cleaningRequest, contract, unit } from "@/db/schema";
import { getSessionClaims } from "@/server/auth/session";
import { isUuid } from "@/server/business/queries";
import { cleaningRequested, cleaningUpdate } from "@/server/notifications/catalog";
import { residentInfo } from "@/server/notifications/context";
import { notifyOwner, notifyResident } from "@/server/notifications/notify";

import { CLEANING_VALUES, requestProblem } from "./rules";

// Limpieza (MT-05): el estado de cada unidad, el interruptor "pedir limpieza" y los pedidos del residente.

export type CleaningResult = { ok: true } | { ok: false; message: string };

type Tx = Parameters<Parameters<typeof withRls>[1]>[0];

class CleaningError extends Error {}

async function run(change: (tx: Tx) => Promise<void>): Promise<CleaningResult> {
  const claims = await getSessionClaims();
  try {
    await withRls(claims, change);
    revalidatePath("/mantenimiento", "layout");
    revalidatePath("/calendario");
    revalidatePath("/panel");
    revalidatePath("/mi", "layout");
    return { ok: true };
  } catch (e) {
    if (e instanceof CleaningError) return { ok: false, message: e.message };
    console.error(e);
    return { ok: false, message: "No pudimos guardar. Vuelve a intentarlo." };
  }
}

const NOT_FOUND_TEXT = "No encontramos ese pedido. Recarga la página.";
const NOT_FOUND: CleaningResult = { ok: false, message: NOT_FOUND_TEXT };

// Prender o apagar "Mis residentes pueden pedir limpieza" (apagado por defecto).
export async function setAcceptsCleaningAction(
  businessId: string,
  accepts: boolean,
): Promise<CleaningResult> {
  if (!isUuid(businessId)) return { ok: false, message: "No encontramos tu negocio. Recarga la página." };
  return run(async (tx) => {
    const rows = await tx
      .update(business)
      .set({ acceptsCleaningRequests: accepts })
      .where(and(eq(business.id, businessId), eq(business.service, "residence")))
      .returning({ id: business.id });
    if (!rows.length) throw new CleaningError("La limpieza es de un negocio de Residencia.");
  });
}

// Limpio, por limpiar o revisado.
export async function setUnitCleaningAction(unitId: string, status: unknown): Promise<CleaningResult> {
  const parsed = z.enum(CLEANING_VALUES).safeParse(status);
  if (!isUuid(unitId) || !parsed.success) return { ok: false, message: "Recarga la página." };
  return run(async (tx) => {
    const rows = await tx
      .update(unit)
      .set({ cleaningStatus: parsed.data })
      .where(eq(unit.id, unitId))
      .returning({ id: unit.id });
    if (!rows.length) throw new CleaningError("No encontramos esa unidad. Recarga la página.");
  });
}

const changeSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("scheduled"), date: z.iso.date({ error: "Elige una fecha." }) }),
  z.object({ status: z.literal("done") }),
  z.object({ status: z.literal("cancelled") }),
]);

// El arrendador le pone fecha, lo marca hecho o lo cancela. Al residente le llega el aviso.
export async function updateCleaningRequestAction(id: string, input: unknown): Promise<CleaningResult> {
  if (!isUuid(id)) return NOT_FOUND;
  const parsed = changeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  const data = parsed.data;
  return run(async (tx) => {
    const [r] = await tx
      .select({
        status: cleaningRequest.status,
        residentId: cleaningRequest.residentId,
        unitId: cleaningRequest.unitId,
      })
      .from(cleaningRequest)
      .where(eq(cleaningRequest.id, id))
      .limit(1);
    if (!r) throw new CleaningError(NOT_FOUND_TEXT);
    const problem = requestProblem(r.status, data.status);
    if (problem) throw new CleaningError(problem);
    await tx
      .update(cleaningRequest)
      .set({
        status: data.status,
        updatedAt: new Date(),
        ...(data.status === "scheduled" ? { scheduledFor: data.date } : {}),
        ...(data.status === "done" ? { doneAt: new Date() } : {}),
      })
      .where(eq(cleaningRequest.id, id));
    // Si se limpió su cuarto, la unidad queda limpia.
    if (data.status === "done" && r.unitId) {
      await tx.update(unit).set({ cleaningStatus: "clean" }).where(eq(unit.id, r.unitId));
    }
    await notifyResident(
      tx,
      r.residentId,
      cleaningUpdate(data.status, data.status === "scheduled" ? data.date : null),
    );
  });
}

const myRequestSchema = z.object({
  residentId: z.uuid(),
  contractId: z.uuid(),
  preferredDate: z.union([z.literal(""), z.iso.date()]).transform((v) => v || null),
  note: z
    .string()
    .trim()
    .max(500, "Máximo 500 letras.")
    .transform((v) => v || null),
});

// El residente pide limpieza de su cuarto (solo si su residencia lo prendió; el RLS lo vuelve a comprobar).
export async function requestCleaningAction(input: unknown): Promise<CleaningResult> {
  const parsed = myRequestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  const data = parsed.data;
  return run(async (tx) => {
    const [c] = await tx
      .select({ unitId: contract.unitId, status: contract.status })
      .from(contract)
      .where(and(eq(contract.id, data.contractId), eq(contract.residentId, data.residentId)))
      .limit(1);
    if (!c || c.status === "cancelled" || c.status === "draft") {
      throw new CleaningError("No encontramos tu contrato. Recarga la página.");
    }
    const who = await residentInfo(tx, data.residentId);
    if (!who) throw new CleaningError("No encontramos tu residencia. Recarga la página.");
    try {
      await tx.transaction((sp) =>
        sp.insert(cleaningRequest).values({
          businessId: who.businessId,
          residentId: data.residentId,
          unitId: c.unitId,
          note: data.note,
          preferredDate: data.preferredDate,
        }),
      );
    } catch {
      throw new CleaningError(
        "Tu residencia no recibe pedidos de limpieza por aquí. Escríbeles en Mensajes.",
      );
    }
    await notifyOwner(tx, who.businessId, cleaningRequested(who.name, null));
  });
}
