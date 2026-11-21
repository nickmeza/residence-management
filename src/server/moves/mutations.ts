import "server-only";

import { and, eq } from "drizzle-orm";

import type { withRls } from "@/db/rls";
import { contract, moveEvent, person, unit } from "@/db/schema";
import { moveScheduled } from "@/server/notifications/catalog";
import { notifyResident } from "@/server/notifications/notify";

import { cleanChecklist } from "./rules";
import type { MoveData } from "./schemas";

type Tx = Parameters<Parameters<typeof withRls>[1]>[0];

export class MoveError extends Error {}

const when = new Intl.DateTimeFormat("es-PE", {
  weekday: "long",
  day: "numeric",
  month: "long",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/Lima",
});

// Guarda la cita, el checklist y si ya se hizo. Si la cita es nueva o cambió, se le avisa al residente.
export async function saveMove(tx: Tx, contractId: string, data: MoveData, userId: string) {
  const [c] = await tx
    .select({ residentId: contract.residentId, unitId: contract.unitId, status: contract.status })
    .from(contract)
    .where(eq(contract.id, contractId))
    .limit(1);
  if (!c) throw new MoveError("No encontramos ese contrato. Recarga la página.");
  if (c.status !== "confirmed" && c.status !== "pending_signature") {
    throw new MoveError("Primero confirma el contrato.");
  }
  const [before] = await tx
    .select({ scheduledAt: moveEvent.scheduledAt, doneAt: moveEvent.doneAt })
    .from(moveEvent)
    .where(and(eq(moveEvent.contractId, contractId), eq(moveEvent.kind, data.kind)))
    .limit(1);
  const [me] = await tx.select({ id: person.id }).from(person).where(eq(person.userId, userId)).limit(1);
  const values = {
    scheduledAt: data.scheduledAt,
    keysCount: data.keysCount,
    checklist: cleanChecklist(data.kind, data.checklist),
    notes: data.notes,
    // Se queda con la primera vez que se marcó hecho.
    doneAt: data.done ? (before?.doneAt ?? new Date()) : null,
    updatedBy: me?.id ?? null,
    updatedAt: new Date(),
  };
  await tx
    .insert(moveEvent)
    .values({ contractId, kind: data.kind, ...values })
    .onConflictDoUpdate({ target: [moveEvent.contractId, moveEvent.kind], set: values });
  // Limpieza (MT-05): al marcar hecha una salida por primera vez, la unidad queda "por limpiar".
  if (data.kind === "check_out" && data.done && !before?.doneAt) {
    await tx.update(unit).set({ cleaningStatus: "dirty" }).where(eq(unit.id, c.unitId));
  }
  const changed = (before?.scheduledAt?.getTime() ?? null) !== (data.scheduledAt?.getTime() ?? null);
  if (data.scheduledAt && changed && !data.done) {
    await notifyResident(tx, c.residentId, moveScheduled(data.kind, when.format(data.scheduledAt)));
  }
}
