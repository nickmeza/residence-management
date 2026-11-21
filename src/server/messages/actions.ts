"use server";

import { and, eq, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { withRls } from "@/db/rls";
import { message, person, resident } from "@/db/schema";
import { getSessionClaims } from "@/server/auth/session";
import { isUuid } from "@/server/business/queries";
import { messageReceived, messageReply } from "@/server/notifications/catalog";
import { residentInfo } from "@/server/notifications/context";
import { notifyOwner, notifyResident } from "@/server/notifications/notify";

// Mensajes (CM-03): el arrendador y el residente se escriben; al otro le llega un aviso a la campanita.

export type MessageResult = { ok: true } | { ok: false; message: string };

const bodySchema = z.string().trim().min(1, "Escribe algo.").max(2000, "Máximo 2000 letras.");
const NOT_FOUND = "No encontramos esa conversación. Recarga la página.";

type Tx = Parameters<Parameters<typeof withRls>[1]>[0];

async function run(change: (tx: Tx, userId: string) => Promise<void>): Promise<MessageResult> {
  const claims = await getSessionClaims();
  try {
    await withRls(claims, (tx) => change(tx, claims.sub));
    revalidatePath("/mensajes", "layout");
    revalidatePath("/mi", "layout");
    return { ok: true };
  } catch (e) {
    if (e instanceof MessageError) return { ok: false, message: e.message };
    console.error(e);
    return { ok: false, message: "No pudimos enviar el mensaje. Vuelve a intentarlo." };
  }
}

class MessageError extends Error {}

async function myPersonId(tx: Tx, userId: string) {
  const [me] = await tx.select({ id: person.id }).from(person).where(eq(person.userId, userId)).limit(1);
  if (!me) throw new MessageError("No encontramos tu cuenta. Vuelve a iniciar sesión.");
  return me.id;
}

// El arrendador escribe a una de sus fichas. El RLS solo deja escribir en fichas de sus negocios.
export async function sendToResidentAction(residentId: string, body: unknown): Promise<MessageResult> {
  if (!isUuid(residentId)) return { ok: false, message: NOT_FOUND };
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  return run(async (tx, userId) => {
    const authorId = await myPersonId(tx, userId);
    await tx.insert(message).values({ residentId, authorId, fromResident: false, body: parsed.data });
    await notifyResident(tx, residentId, messageReply(parsed.data));
  });
}

// El residente escribe a su residencia desde una de sus fichas.
export async function sendToLandlordAction(residentId: string, body: unknown): Promise<MessageResult> {
  if (!isUuid(residentId)) return { ok: false, message: NOT_FOUND };
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  return run(async (tx, userId) => {
    const authorId = await myPersonId(tx, userId);
    const [card] = await tx
      .select({ id: resident.id })
      .from(resident)
      .where(and(eq(resident.id, residentId), eq(resident.personId, authorId)))
      .limit(1);
    if (!card) throw new MessageError(NOT_FOUND);
    await tx.insert(message).values({ residentId, authorId, fromResident: true, body: parsed.data });
    const who = await residentInfo(tx, residentId);
    if (who) await notifyOwner(tx, who.businessId, messageReceived(who.name, parsed.data, residentId));
  });
}

// Al abrir una conversación se marcan como leídos los mensajes del otro lado.
export async function markReadAsLandlordAction(residentId: string): Promise<void> {
  if (!isUuid(residentId)) return;
  const claims = await getSessionClaims();
  await withRls(claims, (tx) =>
    tx
      .update(message)
      .set({ readAt: new Date() })
      .where(and(eq(message.residentId, residentId), eq(message.fromResident, true), isNull(message.readAt))),
  );
  revalidatePath("/mensajes", "layout");
  revalidatePath("/panel");
}

export async function markReadAsResidentAction(residentId: string): Promise<void> {
  if (!isUuid(residentId)) return;
  const claims = await getSessionClaims();
  await withRls(claims, (tx) => tx.execute(sql`select public.read_my_messages(${residentId}::uuid)`));
  revalidatePath("/mi", "layout");
}
