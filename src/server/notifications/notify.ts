import "server-only";

import { sql } from "drizzle-orm";

import type { withRls } from "@/db/rls";
import { notification } from "@/db/schema";

import type { NotificationDraft } from "./catalog";

// Crear notificaciones desde cualquier cambio (pagos, documentos, pensión…). Van dentro de la misma transacción del
// cambio, pero en un "punto de guardado" (savepoint: una transacción dentro de otra): si el aviso falla, se deshace
// solo el aviso y el cambio se guarda igual. Un aviso nunca debe impedir registrar un pago.

type Tx = Parameters<Parameters<typeof withRls>[1]>[0];

async function safely(tx: Tx, query: ReturnType<typeof sql>) {
  try {
    await tx.transaction(async (sp) => {
      await sp.execute(query);
    });
  } catch (e) {
    console.error("No se pudo crear la notificación", e);
  }
}

// Un residente (o comensal) avisa al dueño del negocio donde tiene ficha.
export function notifyOwner(tx: Tx, businessId: string, n: NotificationDraft) {
  return safely(
    tx,
    sql`select public.notify_owner(${businessId}::uuid, ${n.type}, ${n.title}, ${n.body}, ${n.link}, ${n.urgent})`,
  );
}

// El arrendador (o la cocina) avisa a una de sus fichas.
export function notifyResident(tx: Tx, residentId: string, n: NotificationDraft) {
  return safely(
    tx,
    sql`select public.notify_resident(${residentId}::uuid, ${n.type}, ${n.title}, ${n.body}, ${n.link}, ${n.urgent})`,
  );
}

// El mismo aviso a varias fichas (comunicados, menú publicado, cancelar para todos).
export async function notifyResidents(tx: Tx, residentIds: string[], n: NotificationDraft) {
  for (const id of new Set(residentIds)) await notifyResident(tx, id, n);
}

// Solo para código que ya corre como administrador (sin sesión), como aceptar una invitación: ahí no hay auth.uid()
// para las funciones de la base, y quien autoriza es el propio servidor.
export async function insertAsAdmin(
  tx: Tx,
  personId: string,
  businessId: string | null,
  n: NotificationDraft,
) {
  try {
    await tx.transaction(async (sp) => {
      await sp.insert(notification).values({ personId, businessId, ...n });
    });
  } catch (e) {
    console.error("No se pudo crear la notificación", e);
  }
}
