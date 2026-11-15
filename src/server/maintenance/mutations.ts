import "server-only";

import { and, eq } from "drizzle-orm";

import type { withRls } from "@/db/rls";
import {
  business,
  contract,
  floor,
  maintenanceComment,
  maintenanceRequest,
  person,
  property,
  unit,
} from "@/db/schema";
import { isFolderPathOf } from "@/server/documents/files";
import {
  maintenanceComment as commentNotice,
  maintenanceReply,
  maintenanceRequest as requestNotice,
  maintenanceUpdate,
} from "@/server/notifications/catalog";
import { residentInfo } from "@/server/notifications/context";
import { notifyOwner, notifyResident } from "@/server/notifications/notify";

import { isActive, STATUS_LABEL, statusProblem } from "./rules";
import type { LandlordRequestData, RequestUpdateData, ResidentRequestData } from "./schemas";

// Cambios de mantenimiento, dentro de una transacción con la sesión (RLS). El RLS decide qué se puede tocar; aquí van
// las reglas que el RLS no sabe y los avisos.

type Tx = Parameters<Parameters<typeof withRls>[1]>[0];

export class MaintenanceError extends Error {}

// Carpeta de las fotos de pedidos sin residente (los registra el arrendador).
export const GENERAL_FOLDER = "general";

async function myPersonId(tx: Tx, userId: string) {
  const [me] = await tx.select({ id: person.id }).from(person).where(eq(person.userId, userId)).limit(1);
  if (!me) throw new MaintenanceError("No encontramos tu cuenta. Vuelve a iniciar sesión.");
  return me.id;
}

// El residente pide mantenimiento desde uno de sus contratos (MT-01).
export async function createAsResident(tx: Tx, data: ResidentRequestData, userId: string) {
  const [c] = await tx
    .select({ unitId: contract.unitId, status: contract.status })
    .from(contract)
    .where(and(eq(contract.id, data.contractId), eq(contract.residentId, data.residentId)))
    .limit(1);
  if (!c || c.status === "cancelled" || c.status === "draft") {
    throw new MaintenanceError("No encontramos tu contrato. Recarga la página.");
  }
  const who = await residentInfo(tx, data.residentId);
  if (!who) throw new MaintenanceError("No encontramos tu residencia. Recarga la página.");
  if (data.photoPath && !isFolderPathOf(data.photoPath, who.businessId, data.residentId, "mantenimiento")) {
    throw new MaintenanceError("No pudimos usar esa foto. Vuelve a subirla.");
  }
  const [row] = await tx
    .insert(maintenanceRequest)
    .values({
      businessId: who.businessId,
      unitId: c.unitId,
      residentId: data.residentId,
      title: data.title,
      description: data.description,
      category: data.category,
      priority: data.priority,
      photoPath: data.photoPath,
      reportedBy: await myPersonId(tx, userId),
    })
    .returning({ id: maintenanceRequest.id });
  await notifyOwner(
    tx,
    who.businessId,
    requestNotice(who.name, data.title, row.id, data.priority === "urgent"),
  );
  return row.id;
}

// Una unidad de un negocio de quien inició sesión.
async function requireUnitOf(tx: Tx, businessId: string, unitId: string) {
  const [u] = await tx
    .select({ id: unit.id })
    .from(unit)
    .innerJoin(floor, eq(floor.id, unit.floorId))
    .innerJoin(property, eq(property.id, floor.propertyId))
    .where(and(eq(unit.id, unitId), eq(property.businessId, businessId)))
    .limit(1);
  if (!u) throw new MaintenanceError("No encontramos esa unidad. Recarga la página.");
}

// El arrendador registra un pedido (lo vio él o se lo dijeron por WhatsApp).
export async function createAsLandlord(
  tx: Tx,
  businessId: string,
  data: LandlordRequestData,
  userId: string,
) {
  const [b] = await tx
    .select({ id: business.id })
    .from(business)
    .where(and(eq(business.id, businessId), eq(business.service, "residence")))
    .limit(1);
  if (!b) throw new MaintenanceError("Mantenimiento es de un negocio de Residencia.");
  if (data.unitId) await requireUnitOf(tx, businessId, data.unitId);
  if (data.photoPath && !isFolderPathOf(data.photoPath, businessId, GENERAL_FOLDER, "mantenimiento")) {
    throw new MaintenanceError("No pudimos usar esa foto. Vuelve a subirla.");
  }
  const [row] = await tx
    .insert(maintenanceRequest)
    .values({
      businessId,
      unitId: data.unitId,
      title: data.title,
      description: data.description,
      category: data.category,
      priority: data.priority,
      // Sin unidad no hay nada que dejar fuera de servicio.
      blocksUnit: data.unitId ? data.blocksUnit : false,
      assignee: data.assignee,
      photoPath: data.photoPath,
      reportedBy: await myPersonId(tx, userId),
    })
    .returning({ id: maintenanceRequest.id });
  return row.id;
}

// El pedido y el dueño de su negocio. El residente no ve el negocio (RLS): para él, ownerId llega vacío.
async function findRequest(tx: Tx, id: string) {
  const [r] = await tx
    .select({
      id: maintenanceRequest.id,
      unitId: maintenanceRequest.unitId,
      residentId: maintenanceRequest.residentId,
      title: maintenanceRequest.title,
      status: maintenanceRequest.status,
      ownerId: business.ownerId,
    })
    .from(maintenanceRequest)
    .leftJoin(business, eq(business.id, maintenanceRequest.businessId))
    .where(eq(maintenanceRequest.id, id))
    .limit(1);
  if (!r) throw new MaintenanceError("No encontramos ese pedido. Recarga la página.");
  return r;
}

// El arrendador cambia el estado, la prioridad, el responsable o el costo (MT-03). Si cambió el estado, se le avisa
// al residente que lo pidió.
export async function updateRequest(tx: Tx, id: string, data: RequestUpdateData) {
  const r = await findRequest(tx, id);
  if (!r.ownerId) throw new MaintenanceError("Solo tu residencia puede cambiar el pedido.");
  const problem = statusProblem(r.status, data.status);
  if (problem) throw new MaintenanceError(problem);
  const closing = isActive(r.status) && !isActive(data.status);
  await tx
    .update(maintenanceRequest)
    .set({
      status: data.status,
      priority: data.priority,
      assignee: data.assignee,
      cost: data.cost,
      blocksUnit: r.unitId ? data.blocksUnit : false,
      updatedAt: new Date(),
      ...(closing ? { resolvedAt: new Date() } : {}),
    })
    .where(eq(maintenanceRequest.id, id));
  if (r.residentId && r.status !== data.status) {
    await notifyResident(tx, r.residentId, maintenanceUpdate(r.title, STATUS_LABEL[data.status]));
  }
}

// Un comentario del arrendador o del residente. Se le avisa al otro.
export async function addComment(tx: Tx, id: string, body: string, userId: string) {
  const r = await findRequest(tx, id);
  const me = await myPersonId(tx, userId);
  await tx.insert(maintenanceComment).values({ requestId: id, authorId: me, body });
  if (r.ownerId === me) {
    await tx.update(maintenanceRequest).set({ updatedAt: new Date() }).where(eq(maintenanceRequest.id, id));
    if (r.residentId) await notifyResident(tx, r.residentId, maintenanceReply(body));
  } else if (r.residentId) {
    const who = await residentInfo(tx, r.residentId);
    if (who) await notifyOwner(tx, who.businessId, commentNotice(who.name, body, id));
  }
}
