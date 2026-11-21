import "server-only";

import { and, eq, gte, inArray, lte } from "drizzle-orm";

import { withRls } from "@/db/rls";
import {
  business,
  cleaningRequest,
  contract,
  moveEvent,
  person,
  recurringTask,
  resident,
  unit,
} from "@/db/schema";
import { getSessionClaims } from "@/server/auth/session";
import { isUuid } from "@/server/business/queries";
import { limaToday } from "@/server/contracts/dates";
import { buildReceipts, loadBusiness } from "@/server/payments/queries";
import { occurrencesBetween } from "@/server/tasks/rules";

import { monthRange, type CalendarEvent } from "./rules";

const limaDay = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "America/Lima" });

// Lo que pasa en un mes del negocio (DB-04): ingresos y salidas (la cita si hay, si no la fecha del contrato),
// recibos por vencer o vencidos, tareas que se repiten y limpiezas con fecha. null si el negocio no es suyo.
export async function getCalendar(businessId: string, month: string): Promise<CalendarEvent[] | null> {
  if (!isUuid(businessId)) return null;
  const claims = await getSessionClaims();
  const { from, to } = monthRange(month);
  const today = limaToday(new Date());
  return withRls(claims, async (tx) => {
    const [b] = await tx
      .select({ id: business.id })
      .from(business)
      .where(eq(business.id, businessId))
      .limit(1);
    if (!b) return null;
    const events: CalendarEvent[] = [];

    const contracts = await tx
      .select({
        id: contract.id,
        name: person.fullName,
        unitName: unit.name,
        startDate: contract.startDate,
        endDate: contract.endDate,
        status: contract.status,
      })
      .from(contract)
      .innerJoin(resident, eq(resident.id, contract.residentId))
      .innerJoin(person, eq(person.id, resident.personId))
      .innerJoin(unit, eq(unit.id, contract.unitId))
      .where(
        and(
          eq(resident.businessId, businessId),
          inArray(contract.status, ["confirmed", "pending_signature"]),
        ),
      );
    const moves = contracts.length
      ? await tx
          .select({
            contractId: moveEvent.contractId,
            kind: moveEvent.kind,
            scheduledAt: moveEvent.scheduledAt,
          })
          .from(moveEvent)
          .where(
            inArray(
              moveEvent.contractId,
              contracts.map((c) => c.id),
            ),
          )
      : [];
    const cita = new Map(moves.map((m) => [`${m.contractId}|${m.kind}`, m.scheduledAt]));
    for (const c of contracts) {
      const pairs = [
        { kind: "check_in" as const, date: c.startDate, tipo: "ingreso" },
        { kind: "check_out" as const, date: c.endDate, tipo: "salida" },
      ];
      for (const p of pairs) {
        const at = cita.get(`${c.id}|${p.kind}`);
        const date = at ? limaDay(at) : p.date;
        if (!date || date < from || date > to) continue;
        events.push({
          key: `${p.kind}-${c.id}`,
          date,
          kind: p.kind,
          label: `${c.name} · ${c.unitName}`,
          href: `/ingresos/${c.id}?tipo=${p.tipo}`,
        });
      }
    }

    const data = await loadBusiness(tx, businessId);
    const names = new Map(data.residents.map((r) => [r.id, r.name]));
    for (const r of buildReceipts(data.charges, data.payments, names, today)) {
      if (r.status === "paid" || !r.nextDue || r.nextDue < from || r.nextDue > to) continue;
      events.push({
        key: `receipt-${r.residentId}-${r.period}`,
        date: r.nextDue,
        kind: "receipt",
        label: r.residentName,
        href: "/cobros",
        late: r.status === "overdue",
      });
    }

    const tasks = await tx
      .select()
      .from(recurringTask)
      .where(and(eq(recurringTask.businessId, businessId), eq(recurringTask.active, true)));
    for (const t of tasks) {
      const href = t.kind === "cleaning" ? "/mantenimiento/limpieza" : "/mantenimiento/preventivo";
      // Una tarea atrasada se muestra hoy, para que no se pierda.
      if (t.nextDue < today && today >= from && today <= to) {
        events.push({
          key: `task-late-${t.id}`,
          date: today,
          kind: t.kind,
          label: t.title,
          href,
          late: true,
        });
      }
      for (const d of occurrencesBetween(t, from, to)) {
        if (d < today) continue;
        events.push({ key: `task-${t.id}-${d}`, date: d, kind: t.kind, label: t.title, href });
      }
    }

    const cleanings = await tx
      .select({ id: cleaningRequest.id, date: cleaningRequest.scheduledFor, name: person.fullName })
      .from(cleaningRequest)
      .innerJoin(resident, eq(resident.id, cleaningRequest.residentId))
      .innerJoin(person, eq(person.id, resident.personId))
      .where(
        and(
          eq(cleaningRequest.businessId, businessId),
          eq(cleaningRequest.status, "scheduled"),
          gte(cleaningRequest.scheduledFor, from),
          lte(cleaningRequest.scheduledFor, to),
        ),
      );
    for (const c of cleanings) {
      if (!c.date) continue;
      events.push({
        key: `cleaning-${c.id}`,
        date: c.date,
        kind: "cleaning",
        label: `Cuarto de ${c.name}`,
        href: "/mantenimiento/limpieza",
      });
    }
    return events;
  });
}
