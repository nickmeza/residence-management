"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { withRls } from "@/db/rls";
import { parcel, person, resident, visit } from "@/db/schema";
import { getSessionClaims } from "@/server/auth/session";
import { isUuid } from "@/server/business/queries";
import { parcelReceived } from "@/server/notifications/catalog";
import { notifyResident } from "@/server/notifications/notify";
import { issuesByPath } from "@/server/onboarding/schema";

// Visitas (CM-05) y paquetes (CM-06): validan con Zod, guardan con la sesión (RLS) y vuelven a dibujar la pantalla.

export type ReceptionResult =
  { ok: true } | { ok: false; message: string; fieldErrors?: Record<string, string> };

type Tx = Parameters<Parameters<typeof withRls>[1]>[0];

class ReceptionError extends Error {}

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo ${max} letras.`)
    .transform((v) => v || null);

const visitSchema = z.object({
  visitorName: z.string().trim().min(2, "Escribe el nombre de la visita.").max(120, "Máximo 120 letras."),
  residentId: z.uuid().nullable(),
  note: optionalText(300),
});

const parcelSchema = z.object({
  residentId: z.uuid({ error: "Elige para quién es." }),
  description: z.string().trim().min(1, "Describe el paquete.").max(120, "Máximo 120 letras."),
});

const deliverSchema = z.object({ deliveredTo: optionalText(120) });

async function run(path: string, change: (tx: Tx, me: string) => Promise<void>): Promise<ReceptionResult> {
  const claims = await getSessionClaims();
  try {
    await withRls(claims, async (tx) => {
      const [me] = await tx
        .select({ id: person.id })
        .from(person)
        .where(eq(person.userId, claims.sub))
        .limit(1);
      if (!me) throw new ReceptionError("No encontramos tu cuenta. Vuelve a iniciar sesión.");
      await change(tx, me.id);
    });
    revalidatePath(path);
    revalidatePath("/panel");
    revalidatePath("/mi", "layout");
    return { ok: true };
  } catch (e) {
    if (e instanceof ReceptionError) return { ok: false, message: e.message };
    console.error(e);
    return { ok: false, message: "No pudimos guardar. Vuelve a intentarlo." };
  }
}

// La ficha debe ser de este negocio (el RLS ya la limita a los negocios de quien inició sesión).
async function requireResident(tx: Tx, businessId: string, residentId: string) {
  const [r] = await tx
    .select({ id: resident.id })
    .from(resident)
    .where(and(eq(resident.id, residentId), eq(resident.businessId, businessId)))
    .limit(1);
  if (!r) throw new ReceptionError("No encontramos a esa persona. Recarga la página.");
}

const NO_BUSINESS: ReceptionResult = { ok: false, message: "No encontramos tu negocio. Recarga la página." };
const NOT_FOUND: ReceptionResult = { ok: false, message: "No encontramos ese registro. Recarga la página." };

export async function addVisitAction(businessId: string, input: unknown): Promise<ReceptionResult> {
  if (!isUuid(businessId)) return NO_BUSINESS;
  const parsed = visitSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Revisa los campos marcados.", fieldErrors: issuesByPath(parsed.error) };
  }
  return run("/visitas", async (tx, me) => {
    if (parsed.data.residentId) await requireResident(tx, businessId, parsed.data.residentId);
    await tx.insert(visit).values({ businessId, ...parsed.data, createdBy: me });
  });
}

// "Ya se fue": anota la hora de salida (solo si sigue adentro).
export async function visitLeftAction(id: string): Promise<ReceptionResult> {
  if (!isUuid(id)) return NOT_FOUND;
  return run("/visitas", async (tx) => {
    await tx
      .update(visit)
      .set({ leftAt: new Date() })
      .where(and(eq(visit.id, id), isNull(visit.leftAt)));
  });
}

export async function deleteVisitAction(id: string): Promise<ReceptionResult> {
  if (!isUuid(id)) return NOT_FOUND;
  return run("/visitas", async (tx) => {
    await tx.delete(visit).where(eq(visit.id, id));
  });
}

// Llegó un paquete: se guarda y se le avisa al residente.
export async function addParcelAction(businessId: string, input: unknown): Promise<ReceptionResult> {
  if (!isUuid(businessId)) return NO_BUSINESS;
  const parsed = parcelSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Revisa los campos marcados.", fieldErrors: issuesByPath(parsed.error) };
  }
  return run("/visitas/paquetes", async (tx, me) => {
    await requireResident(tx, businessId, parsed.data.residentId);
    await tx.insert(parcel).values({ businessId, ...parsed.data, createdBy: me });
    await notifyResident(tx, parsed.data.residentId, parcelReceived(parsed.data.description));
  });
}

// Lo recogió el residente (o alguien por él).
export async function deliverParcelAction(id: string, input: unknown): Promise<ReceptionResult> {
  if (!isUuid(id)) return NOT_FOUND;
  const parsed = deliverSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Máximo 120 letras." };
  return run("/visitas/paquetes", async (tx) => {
    await tx
      .update(parcel)
      .set({ deliveredAt: new Date(), deliveredTo: parsed.data.deliveredTo })
      .where(and(eq(parcel.id, id), isNull(parcel.deliveredAt)));
  });
}

export async function deleteParcelAction(id: string): Promise<ReceptionResult> {
  if (!isUuid(id)) return NOT_FOUND;
  return run("/visitas/paquetes", async (tx) => {
    await tx.delete(parcel).where(eq(parcel.id, id));
  });
}
