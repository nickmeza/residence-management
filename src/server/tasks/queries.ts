import "server-only";

import { and, asc, desc, eq, inArray } from "drizzle-orm";

import { withRls } from "@/db/rls";
import { business, maintenanceRequest, property, recurringTask, supplier, taskLog } from "@/db/schema";
import { getSessionClaims } from "@/server/auth/session";
import { isUuid } from "@/server/business/queries";

import type { TaskKind, TaskPeriod } from "./rules";

export type TaskRow = {
  id: string;
  kind: TaskKind;
  title: string;
  place: string | null;
  propertyId: string | null;
  propertyName: string | null;
  every: number;
  period: TaskPeriod;
  nextDue: string;
  supplierId: string | null;
  supplierName: string | null;
  notes: string | null;
  active: boolean;
  lastDone: string | null;
};

export type Option = { id: string; name: string };

// Tareas de un tipo (mantenimiento o limpieza) del negocio, con lo que hace falta para el formulario. null si el
// negocio no es de quien inició sesión.
export async function listTasks(
  businessId: string,
  kind: TaskKind,
): Promise<{ rows: TaskRow[]; suppliers: Option[]; properties: Option[] } | null> {
  if (!isUuid(businessId)) return null;
  const claims = await getSessionClaims();
  return withRls(claims, async (tx) => {
    const [b] = await tx
      .select({ id: business.id })
      .from(business)
      .where(eq(business.id, businessId))
      .limit(1);
    if (!b) return null;
    const [tasks, suppliers, properties] = await Promise.all([
      tx
        .select({
          id: recurringTask.id,
          kind: recurringTask.kind,
          title: recurringTask.title,
          place: recurringTask.place,
          propertyId: recurringTask.propertyId,
          propertyName: property.name,
          every: recurringTask.every,
          period: recurringTask.period,
          nextDue: recurringTask.nextDue,
          supplierId: recurringTask.supplierId,
          supplierName: supplier.name,
          notes: recurringTask.notes,
          active: recurringTask.active,
        })
        .from(recurringTask)
        .leftJoin(property, eq(property.id, recurringTask.propertyId))
        .leftJoin(supplier, eq(supplier.id, recurringTask.supplierId))
        .where(and(eq(recurringTask.businessId, businessId), eq(recurringTask.kind, kind)))
        .orderBy(desc(recurringTask.active), asc(recurringTask.nextDue)),
      listSupplierOptions(tx, businessId),
      tx
        .select({ id: property.id, name: property.name })
        .from(property)
        .where(eq(property.businessId, businessId))
        .orderBy(asc(property.name)),
    ]);
    const logs = tasks.length
      ? await tx
          .selectDistinctOn([taskLog.taskId], { taskId: taskLog.taskId, doneOn: taskLog.doneOn })
          .from(taskLog)
          .where(
            inArray(
              taskLog.taskId,
              tasks.map((t) => t.id),
            ),
          )
          .orderBy(taskLog.taskId, desc(taskLog.doneOn))
      : [];
    const last = new Map(logs.map((l) => [l.taskId, l.doneOn]));
    return { rows: tasks.map((t) => ({ ...t, lastDone: last.get(t.id) ?? null })), suppliers, properties };
  });
}

type Tx = Parameters<Parameters<typeof withRls>[1]>[0];

export function listSupplierOptions(tx: Tx, businessId: string): Promise<Option[]> {
  return tx
    .select({ id: supplier.id, name: supplier.name })
    .from(supplier)
    .where(eq(supplier.businessId, businessId))
    .orderBy(asc(supplier.name));
}

export type SupplierRow = {
  id: string;
  name: string;
  trade: string | null;
  phone: string | null;
  note: string | null;
  jobs: number;
};

// Directorio de proveedores (MT-06) con cuántos trabajos tienen anotados.
export async function listSuppliers(businessId: string): Promise<SupplierRow[] | null> {
  if (!isUuid(businessId)) return null;
  const claims = await getSessionClaims();
  return withRls(claims, async (tx) => {
    const [b] = await tx
      .select({ id: business.id })
      .from(business)
      .where(eq(business.id, businessId))
      .limit(1);
    if (!b) return null;
    const rows = await tx
      .select()
      .from(supplier)
      .where(eq(supplier.businessId, businessId))
      .orderBy(asc(supplier.name));
    if (!rows.length) return [];
    const ids = rows.map((r) => r.id);
    const [requests, logs] = await Promise.all([
      tx
        .select({ supplierId: maintenanceRequest.supplierId })
        .from(maintenanceRequest)
        .where(inArray(maintenanceRequest.supplierId, ids)),
      tx.select({ supplierId: taskLog.supplierId }).from(taskLog).where(inArray(taskLog.supplierId, ids)),
    ]);
    const jobs = new Map<string, number>();
    for (const r of [...requests, ...logs]) {
      if (r.supplierId) jobs.set(r.supplierId, (jobs.get(r.supplierId) ?? 0) + 1);
    }
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      trade: r.trade,
      phone: r.phone,
      note: r.note,
      jobs: jobs.get(r.id) ?? 0,
    }));
  });
}

export type SupplierJob = {
  key: string;
  date: string;
  title: string;
  source: "request" | "task";
  href: string | null;
  cost: string | null;
};

// Ficha de un proveedor con su historial: pedidos de mantenimiento y tareas que hizo, lo más nuevo primero.
export async function getSupplier(
  id: string,
): Promise<(SupplierRow & { businessId: string; history: SupplierJob[]; totalCost: number }) | null> {
  if (!isUuid(id)) return null;
  const claims = await getSessionClaims();
  return withRls(claims, async (tx) => {
    const [s] = await tx.select().from(supplier).where(eq(supplier.id, id)).limit(1);
    if (!s) return null;
    const [requests, logs] = await Promise.all([
      tx
        .select({
          id: maintenanceRequest.id,
          title: maintenanceRequest.title,
          createdAt: maintenanceRequest.createdAt,
          resolvedAt: maintenanceRequest.resolvedAt,
          cost: maintenanceRequest.cost,
        })
        .from(maintenanceRequest)
        .where(eq(maintenanceRequest.supplierId, id)),
      tx
        .select({ id: taskLog.id, title: recurringTask.title, doneOn: taskLog.doneOn, cost: taskLog.cost })
        .from(taskLog)
        .innerJoin(recurringTask, eq(recurringTask.id, taskLog.taskId))
        .where(eq(taskLog.supplierId, id)),
    ]);
    const limaDay = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "America/Lima" });
    const history: SupplierJob[] = [
      ...requests.map((r) => ({
        key: `r-${r.id}`,
        date: limaDay(r.resolvedAt ?? r.createdAt),
        title: r.title,
        source: "request" as const,
        href: `/mantenimiento/${r.id}`,
        cost: r.cost,
      })),
      ...logs.map((l) => ({
        key: `t-${l.id}`,
        date: l.doneOn,
        title: l.title,
        source: "task" as const,
        href: null,
        cost: l.cost,
      })),
    ].sort((a, b) => b.date.localeCompare(a.date));
    const totalCost = history.reduce((n, h) => n + (h.cost ? Number(h.cost) : 0), 0);
    return {
      id: s.id,
      businessId: s.businessId,
      name: s.name,
      trade: s.trade,
      phone: s.phone,
      note: s.note,
      jobs: history.length,
      history,
      totalCost,
    };
  });
}

// Proveedores para elegir en un pedido de mantenimiento.
export async function getSupplierOptions(businessId: string): Promise<Option[]> {
  if (!isUuid(businessId)) return [];
  const claims = await getSessionClaims();
  return withRls(claims, (tx) => listSupplierOptions(tx, businessId));
}
