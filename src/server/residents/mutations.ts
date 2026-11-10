import "server-only";

import { randomUUID } from "node:crypto";

import { and, eq, isNull } from "drizzle-orm";

import type { withRls } from "@/db/rls";
import { business, person, resident, residentInvitation } from "@/db/schema";

import { hashInvitationToken } from "./invitation";
import { splitResident, type ResidentData } from "./schemas";

// Cambios de residentes dentro de una transacción con la sesión (RLS). Las acciones validan antes.

type Tx = Parameters<Parameters<typeof withRls>[1]>[0];

// La ficha con su persona, solo si es de un negocio de quien inició sesión.
async function findOwnResident(tx: Tx, id: string) {
  const [row] = await tx
    .select({
      personId: resident.personId,
      fullName: person.fullName,
      phone: person.phone,
      userId: person.userId,
      businessName: business.tradeName,
    })
    .from(resident)
    .innerJoin(person, eq(person.id, resident.personId))
    .innerJoin(business, eq(business.id, resident.businessId))
    .where(eq(resident.id, id))
    .limit(1);
  return row ?? null;
}

// Crea la persona (sin cuenta) y su ficha en el negocio. null si el negocio no es de quien inició sesión.
export async function createResident(tx: Tx, businessId: string, data: ResidentData) {
  const [own] = await tx
    .select({ id: business.id })
    .from(business)
    .where(eq(business.id, businessId))
    .limit(1);
  if (!own) return null;
  const { personal, card } = splitResident(data);
  // El id se crea aquí: el arrendador todavía no puede leer a esta persona hasta que exista su ficha,
  // así que no se le puede pedir a la base que la devuelva.
  const personId = randomUUID();
  await tx.insert(person).values({ id: personId, ...personal });
  const [row] = await tx
    .insert(resident)
    .values({ businessId, personId, ...card })
    .returning({ id: resident.id });
  return row.id;
}

// Edita la ficha. Los datos personales solo se cambian si el residente todavía no tiene cuenta;
// si ya la tiene, se editan desde su cuenta (y el RLS tampoco dejaría cambiarlos). false si no es suya.
export async function updateResident(tx: Tx, id: string, data: ResidentData) {
  const row = await findOwnResident(tx, id);
  if (!row) return false;
  const { personal, card } = splitResident(data);
  await tx.update(resident).set(card).where(eq(resident.id, id));
  if (row.userId === null) await tx.update(person).set(personal).where(eq(person.id, row.personId));
  return true;
}

// Guarda una invitación nueva (solo el hash del enlace) y borra las anteriores que no se usaron.
export async function createInvitation(
  tx: Tx,
  input: { residentId: string; token: string; expiresAt: Date; userId: string },
) {
  const row = await findOwnResident(tx, input.residentId);
  if (!row) return { status: "not_found" as const };
  if (row.userId !== null) return { status: "has_account" as const };
  const [me] = await tx
    .select({ id: person.id })
    .from(person)
    .where(eq(person.userId, input.userId))
    .limit(1);
  await tx
    .delete(residentInvitation)
    .where(and(eq(residentInvitation.residentId, input.residentId), isNull(residentInvitation.acceptedAt)));
  await tx.insert(residentInvitation).values({
    residentId: input.residentId,
    tokenHash: hashInvitationToken(input.token),
    expiresAt: input.expiresAt,
    createdBy: me.id,
  });
  return {
    status: "ok" as const,
    fullName: row.fullName,
    phone: row.phone,
    businessName: row.businessName,
  };
}
