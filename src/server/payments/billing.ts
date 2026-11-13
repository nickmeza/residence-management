import "server-only";

import { and, eq, inArray } from "drizzle-orm";

import type { withRls } from "@/db/rls";
import {
  business,
  charge,
  contract,
  deposit,
  depositSettings,
  depositUnitException,
  resident,
  unit,
} from "@/db/schema";
import { limaToday } from "@/server/contracts/dates";
import { depositAmount, effectivePolicy, type DepositPolicy } from "@/server/deposits/rules";

import { chargeChanges, daysInPeriod, periodOf, rentCharges } from "./rules";

// Recibos y garantía de un contrato, dentro de una transacción con la sesión del arrendador (RLS).
// Se llama cada vez que un contrato cambia (confirmar, terminar, cambiar condiciones) y al abrir Cobros,
// para que los cargos siempre coincidan con el contrato. Es idempotente: correrlo dos veces no duplica nada.

type Tx = Parameters<Parameters<typeof withRls>[1]>[0];

async function loadContract(tx: Tx, contractId: string) {
  const [row] = await tx
    .select({
      id: contract.id,
      status: contract.status,
      startDate: contract.startDate,
      endDate: contract.endDate,
      monthlyRent: contract.monthlyRent,
      paymentDay: contract.paymentDay,
      renewedFromId: contract.renewedFromId,
      depositRule: contract.depositRule,
      depositFixedAmount: contract.depositFixedAmount,
      depositDueDate: contract.depositDueDate,
      unitId: contract.unitId,
      unitType: unit.type,
      businessId: resident.businessId,
      prorate: business.prorateRent,
    })
    .from(contract)
    .innerJoin(resident, eq(resident.id, contract.residentId))
    .innerJoin(business, eq(business.id, resident.businessId))
    .innerJoin(unit, eq(unit.id, contract.unitId))
    .where(eq(contract.id, contractId))
    .limit(1);
  return row ?? null;
}

type LoadedContract = NonNullable<Awaited<ReturnType<typeof loadContract>>>;

// La política que vale para el contrato: la de la persona, la de la unidad o la del negocio (regla 5).
export async function contractDepositPolicy(tx: Tx, c: LoadedContract): Promise<DepositPolicy> {
  const [settings] = await tx
    .select()
    .from(depositSettings)
    .where(eq(depositSettings.businessId, c.businessId))
    .limit(1);
  const [exception] = await tx
    .select()
    .from(depositUnitException)
    .where(eq(depositUnitException.unitId, c.unitId))
    .limit(1);
  const businessPolicy = settings
    ? c.unitType === "room"
      ? { rule: settings.roomRule, fixedAmount: settings.roomFixedAmount }
      : { rule: settings.apartmentRule, fixedAmount: settings.apartmentFixedAmount }
    : null;
  return effectivePolicy({
    business: businessPolicy,
    unit: exception ? { rule: exception.rule, fixedAmount: exception.fixedAmount } : null,
    contract: c.depositRule ? { rule: c.depositRule, fixedAmount: c.depositFixedAmount } : null,
  });
}

// Crea la garantía del contrato (y su cargo en el recibo del mes en que se cobra). Regla 9: si renueva otro
// contrato con garantía, esa pasa a este y no se pide otra. Si el anterior no tenía (se confirmó antes de la
// Fase 5), este es el primero con garantía en el sistema y se calcula con la política de hoy.
async function ensureDeposit(tx: Tx, c: LoadedContract): Promise<void> {
  const [existing] = await tx.select({ id: deposit.id }).from(deposit).where(eq(deposit.contractId, c.id));
  if (existing) return;
  if (c.renewedFromId) {
    const previous = await loadContract(tx, c.renewedFromId);
    if (previous) {
      const moved = await tx
        .update(deposit)
        .set({ contractId: c.id })
        .where(eq(deposit.contractId, previous.id))
        .returning({ id: deposit.id });
      if (moved.length) return;
    }
  }
  const policy = await contractDepositPolicy(tx, c);
  const amount = depositAmount(policy, c.monthlyRent);
  if (Number(amount) === 0) {
    await tx.insert(deposit).values({ contractId: c.id, amount, rule: "none", status: "none" });
    return;
  }
  const due = c.depositDueDate ?? c.startDate;
  const [row] = await tx
    .insert(charge)
    .values({ contractId: c.id, concept: "deposit", period: periodOf(due), amount, dueDate: due })
    .returning({ id: charge.id });
  await tx
    .insert(deposit)
    .values({ contractId: c.id, amount, rule: policy.rule, status: "held", chargeId: row.id });
}

// Deja los cargos de renta igual a lo que dice el contrato (meses, días del mes incompleto, día de pago).
async function syncRent(tx: Tx, c: LoadedContract, today: string) {
  const expected = rentCharges({ ...c, today });
  const existing = await tx
    .select({ id: charge.id, period: charge.period, amount: charge.amount, dueDate: charge.dueDate })
    .from(charge)
    .where(and(eq(charge.contractId, c.id), eq(charge.concept, "rent")));
  const changes = chargeChanges(existing, expected);
  const noteOf = (days: number | null, period: string) =>
    days === null ? null : `${days} de ${daysInPeriod(period)} días`;
  if (changes.insert.length) {
    await tx.insert(charge).values(
      changes.insert.map((x) => ({
        contractId: c.id,
        concept: "rent" as const,
        period: x.period,
        amount: x.amount,
        dueDate: x.dueDate,
        note: noteOf(x.days, x.period),
      })),
    );
  }
  const periodById = new Map(existing.map((e) => [e.id, e.period]));
  const expectedByPeriod = new Map(expected.map((x) => [x.period, x]));
  for (const u of changes.update) {
    const x = expectedByPeriod.get(periodById.get(u.id)!)!;
    await tx
      .update(charge)
      .set({ amount: u.amount, dueDate: u.dueDate, note: noteOf(x.days, x.period) })
      .where(eq(charge.id, u.id));
  }
  if (changes.remove.length) await tx.delete(charge).where(inArray(charge.id, changes.remove));
}

// Al cambiar un contrato. Los recibos y la garantía nacen al confirmarlo (decisión del dueño). Si después vuelve a
// "pendiente de firma" (cambió el papel), sus recibos siguen: el residente sigue viviendo ahí.
// withDeposit = false al abrir Cobros: la garantía se calcula solo al confirmar, para no cobrarla de forma
// retroactiva a contratos confirmados antes de la Fase 5 con la configuración de hoy.
export async function syncContractBilling(
  tx: Tx,
  contractIds: string[],
  now = new Date(),
  withDeposit = true,
) {
  const today = limaToday(now);
  for (const id of contractIds) {
    const c = await loadContract(tx, id);
    if (!c) continue;
    if (c.status === "confirmed") {
      if (withDeposit) await ensureDeposit(tx, c);
      await syncRent(tx, c, today);
      continue;
    }
    const [hasCharges] = await tx
      .select({ id: charge.id })
      .from(charge)
      .where(and(eq(charge.contractId, id), eq(charge.concept, "rent")))
      .limit(1);
    if (hasCharges && c.status === "pending_signature") await syncRent(tx, c, today);
  }
}

// Todos los contratos de un negocio (al abrir Cobros o Garantías): extiende los mes a mes y crea los recibos de
// renta que falten (por ejemplo, de contratos confirmados antes de la Fase 5). La garantía no.
export async function syncBusinessBilling(tx: Tx, businessId: string, now = new Date()) {
  const rows = await tx
    .select({ id: contract.id })
    .from(contract)
    .innerJoin(resident, eq(resident.id, contract.residentId))
    .where(
      and(eq(resident.businessId, businessId), inArray(contract.status, ["confirmed", "pending_signature"])),
    );
  await syncContractBilling(
    tx,
    rows.map((r) => r.id),
    now,
    false,
  );
}
