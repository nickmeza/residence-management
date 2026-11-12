import "server-only";

import { and, eq, gt, isNull } from "drizzle-orm";

import { db } from "@/db";
import { business, person, resident, residentInvitation } from "@/db/schema";

import { hashInvitationToken } from "./invitation";
import { mergePersonData } from "./merge";

// Aceptar una invitación: la ficha que creó el arrendador pasa a la persona de la cuenta que acaba de entrar con
// su código. Corre como administrador (sin RLS) porque, antes de aceptar, la cuenta nueva todavía no tiene
// permiso de ver esa ficha. Lo que autoriza es el enlace (en la base está su hash) más la sesión verificada.

export class InvitationError extends Error {}

const openInvitation = (token: string) =>
  and(
    eq(residentInvitation.tokenHash, hashInvitationToken(token)),
    isNull(residentInvitation.acceptedAt),
    gt(residentInvitation.expiresAt, new Date()),
  );

export type OpenInvitation = { residentName: string; businessName: string; email: string | null };

// La invitación vigente de un enlace, para mostrar "Hola María, Residencia X te invita". null si ya no sirve.
// Solo devuelve el nombre, la residencia y el correo que puso el arrendador: nada más de la ficha.
export async function findOpenInvitation(token: string): Promise<OpenInvitation | null> {
  const [row] = await db
    .select({ residentName: person.fullName, businessName: business.tradeName, email: person.email })
    .from(residentInvitation)
    .innerJoin(resident, eq(resident.id, residentInvitation.residentId))
    .innerJoin(person, eq(person.id, resident.personId))
    .innerJoin(business, eq(business.id, resident.businessId))
    .where(openInvitation(token))
    .limit(1);
  return row ?? null;
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export function acceptInvitation(token: string, userId: string, email: string | null) {
  return db.transaction((tx) => acceptInvitationIn(tx, token, userId, email));
}

// Separada para poder probarla dentro de una transacción que se deshace (tests/db).
export async function acceptInvitationIn(tx: Tx, token: string, userId: string, email: string | null) {
  const [inv] = await tx
    .select({ id: residentInvitation.id, residentId: residentInvitation.residentId })
    .from(residentInvitation)
    .where(openInvitation(token))
    .limit(1);
  if (!inv) throw new InvitationError("Este enlace ya se usó o venció. Pídele a tu residencia uno nuevo.");

  const [card] = await tx
    .select({ businessId: resident.businessId, invited: person })
    .from(resident)
    .innerJoin(person, eq(person.id, resident.personId))
    .where(eq(resident.id, inv.residentId))
    .limit(1);
  // La persona de la cuenta la crea la base al registrarse (trigger de la migración 0001).
  const [account] = await tx.select().from(person).where(eq(person.userId, userId)).limit(1);
  if (!card || !account) throw new InvitationError("No pudimos aceptar la invitación. Vuelve a intentarlo.");

  const invited = card.invited;
  if (invited.id !== account.id) {
    if (invited.userId) throw new InvitationError("Esta invitación ya la aceptó otra cuenta.");
    const [already] = await tx
      .select({ id: resident.id })
      .from(resident)
      .where(and(eq(resident.businessId, card.businessId), eq(resident.personId, account.id)))
      .limit(1);
    if (already) throw new InvitationError("Tu cuenta ya está en esta residencia.");

    // Ganan los datos de la cuenta (lo que puso el residente); lo que falte se completa con lo del arrendador.
    await tx
      .update(person)
      .set(mergePersonData(account, invited, email))
      .where(eq(person.id, account.id));
    await tx.update(resident).set({ personId: account.id }).where(eq(resident.personId, invited.id));
    // La persona que creó el arrendador ya no hace falta: sus fichas pasaron a la cuenta.
    await tx.delete(person).where(eq(person.id, invited.id));
  }

  await tx
    .update(residentInvitation)
    .set({ acceptedAt: new Date() })
    .where(eq(residentInvitation.id, inv.id));
  return { residentId: inv.residentId };
}
