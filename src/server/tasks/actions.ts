"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { withRls } from "@/db/rls";
import { person, property, recurringTask, supplier, taskLog } from "@/db/schema";
import { getSessionClaims } from "@/server/auth/session";
import { isUuid } from "@/server/business/queries";
import { issuesByPath } from "@/server/onboarding/schema";

import { nextDueAfter } from "./rules";
import { doneSchema, supplierSchema, taskSchema, type TaskData } from "./schemas";

// Tareas que se repiten (MT-04, limpieza de áreas comunes) y proveedores (MT-06). Validan con Zod y guardan con la
// sesión (RLS): solo se tocan las filas de los negocios de quien inició sesión.

export type TaskResult =
  { ok: true; id?: string } | { ok: false; message: string; fieldErrors?: Record<string, string> };

type Tx = Parameters<Parameters<typeof withRls>[1]>[0];

class TaskError extends Error {}

async function run(change: (tx: Tx, userId: string) => Promise<string | void>): Promise<TaskResult> {
  const claims = await getSessionClaims();
  try {
    const id = await withRls(claims, (tx) => change(tx, claims.sub));
    revalidatePath("/mantenimiento", "layout");
    revalidatePath("/calendario");
    revalidatePath("/panel");
    return { ok: true, id: id ?? undefined };
  } catch (e) {
    if (e instanceof TaskError) return { ok: false, message: e.message };
    console.error(e);
    return { ok: false, message: "No pudimos guardar. Vuelve a intentarlo." };
  }
}

const invalid = (error: Parameters<typeof issuesByPath>[0]): TaskResult => ({
  ok: false,
  message: "Revisa los campos marcados.",
  fieldErrors: issuesByPath(error),
});
const NOT_FOUND: TaskResult = { ok: false, message: "No encontramos esa tarea. Recarga la página." };

// El edificio y el proveedor elegidos deben ser del mismo negocio.
async function checkLinks(
  tx: Tx,
  businessId: string,
  data: { propertyId: string | null; supplierId: string | null },
) {
  if (data.propertyId) {
    const [p] = await tx
      .select({ id: property.id })
      .from(property)
      .where(and(eq(property.id, data.propertyId), eq(property.businessId, businessId)))
      .limit(1);
    if (!p) throw new TaskError("No encontramos ese edificio. Recarga la página.");
  }
  if (data.supplierId) {
    const [s] = await tx
      .select({ id: supplier.id })
      .from(supplier)
      .where(and(eq(supplier.id, data.supplierId), eq(supplier.businessId, businessId)))
      .limit(1);
    if (!s) throw new TaskError("No encontramos ese proveedor. Recarga la página.");
  }
}

async function taskBusiness(tx: Tx, id: string) {
  const [t] = await tx.select().from(recurringTask).where(eq(recurringTask.id, id)).limit(1);
  if (!t) throw new TaskError("No encontramos esa tarea. Recarga la página.");
  return t;
}

export async function createTaskAction(businessId: string, input: unknown): Promise<TaskResult> {
  if (!isUuid(businessId)) return { ok: false, message: "No encontramos tu negocio. Recarga la página." };
  const parsed = taskSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  return run(async (tx) => {
    await checkLinks(tx, businessId, parsed.data);
    const [row] = await tx
      .insert(recurringTask)
      .values({ businessId, ...parsed.data })
      .returning({ id: recurringTask.id });
    return row.id;
  });
}

export async function updateTaskAction(id: string, input: unknown): Promise<TaskResult> {
  if (!isUuid(id)) return NOT_FOUND;
  const parsed = taskSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  return run(async (tx) => {
    const t = await taskBusiness(tx, id);
    await checkLinks(tx, t.businessId, parsed.data);
    const { kind: _kind, ...data }: TaskData = parsed.data;
    void _kind;
    await tx.update(recurringTask).set(data).where(eq(recurringTask.id, id));
  });
}

// "Hecho": queda en el historial y la próxima fecha se calcula sola (manteniendo el ritmo).
export async function markTaskDoneAction(id: string, input: unknown): Promise<TaskResult> {
  if (!isUuid(id)) return NOT_FOUND;
  const parsed = doneSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  return run(async (tx, userId) => {
    const t = await taskBusiness(tx, id);
    if (!t.active) throw new TaskError("Esta tarea está pausada. Reactívala para marcarla.");
    await checkLinks(tx, t.businessId, { propertyId: null, supplierId: parsed.data.supplierId });
    const [me] = await tx.select({ id: person.id }).from(person).where(eq(person.userId, userId)).limit(1);
    await tx.insert(taskLog).values({ taskId: id, ...parsed.data, doneBy: me?.id ?? null });
    await tx
      .update(recurringTask)
      .set({ nextDue: nextDueAfter(t.nextDue, t.every, t.period, parsed.data.doneOn) })
      .where(eq(recurringTask.id, id));
  });
}

// Pausar o reactivar (por ejemplo, la limpieza del pasillo en vacaciones).
export async function setTaskActiveAction(id: string, active: boolean): Promise<TaskResult> {
  if (!isUuid(id)) return NOT_FOUND;
  return run(async (tx) => {
    await taskBusiness(tx, id);
    await tx.update(recurringTask).set({ active }).where(eq(recurringTask.id, id));
  });
}

// Borrar la tarea y su historial (con confirmación en la pantalla).
export async function deleteTaskAction(id: string): Promise<TaskResult> {
  if (!isUuid(id)) return NOT_FOUND;
  return run(async (tx) => {
    await tx.delete(recurringTask).where(eq(recurringTask.id, id));
  });
}

// --- Proveedores ---

export async function createSupplierAction(businessId: string, input: unknown): Promise<TaskResult> {
  if (!isUuid(businessId)) return { ok: false, message: "No encontramos tu negocio. Recarga la página." };
  const parsed = supplierSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  return run(async (tx) => {
    const [row] = await tx
      .insert(supplier)
      .values({ businessId, ...parsed.data })
      .returning({ id: supplier.id });
    return row.id;
  });
}

export async function updateSupplierAction(id: string, input: unknown): Promise<TaskResult> {
  if (!isUuid(id)) return { ok: false, message: "No encontramos ese proveedor. Recarga la página." };
  const parsed = supplierSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  return run(async (tx) => {
    await tx.update(supplier).set(parsed.data).where(eq(supplier.id, id));
  });
}

// Borrar un proveedor: sus trabajos se quedan, pero sin su nombre.
export async function deleteSupplierAction(id: string): Promise<TaskResult> {
  if (!isUuid(id)) return { ok: false, message: "No encontramos ese proveedor. Recarga la página." };
  return run(async (tx) => {
    await tx.delete(supplier).where(eq(supplier.id, id));
  });
}
