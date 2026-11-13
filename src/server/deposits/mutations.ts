import "server-only";

import { eq, sql } from "drizzle-orm";

import type { withRls } from "@/db/rls";
import {
  charge,
  contract,
  deposit,
  depositRefund,
  entryReport,
  resident,
  settlement,
  settlementDiscount,
} from "@/db/schema";
import { limaToday } from "@/server/contracts/dates";
import { isFolderPathOf } from "@/server/documents/files";
import { myPersonId } from "@/server/payments/mutations";
import { periodOf } from "@/server/payments/rules";
import type { EntryReportInput } from "@/server/payments/schemas";

import { discountProblems, settlement as settle, type InspectionArea } from "./rules";

// Liquidación de la garantía (GA-08 a GA-15) y reportes de ingreso, dentro de una transacción con la sesión (RLS).

type Tx = Parameters<Parameters<typeof withRls>[1]>[0];

export class DepositError extends Error {}

const NOT_FOUND = "No encontramos esa garantía. Recarga la página.";

// La garantía con su contrato y su liquidación (si hay). El RLS decide si quien inició sesión la ve.
async function findDeposit(tx: Tx, depositId: string) {
  const [row] = await tx
    .select({
      id: deposit.id,
      amount: deposit.amount,
      status: deposit.status,
      contractId: deposit.contractId,
      residentId: contract.residentId,
      businessId: resident.businessId,
      settlementId: settlement.id,
      settlementStatus: settlement.status,
      excessChargeId: settlement.excessChargeId,
      excessWaived: settlement.excessWaived,
    })
    .from(deposit)
    .innerJoin(contract, eq(contract.id, deposit.contractId))
    .innerJoin(resident, eq(resident.id, contract.residentId))
    .leftJoin(settlement, eq(settlement.depositId, deposit.id))
    .where(eq(deposit.id, depositId))
    .limit(1);
  if (!row) throw new DepositError(NOT_FOUND);
  return row;
}

async function findBySettlement(tx: Tx, settlementId: string) {
  const [row] = await tx
    .select({ depositId: settlement.depositId })
    .from(settlement)
    .where(eq(settlement.id, settlementId))
    .limit(1);
  if (!row) throw new DepositError(NOT_FOUND);
  return findDeposit(tx, row.depositId);
}

// Montos de la liquidación con lo guardado (descuentos y devoluciones).
async function summary(tx: Tx, d: Awaited<ReturnType<typeof findDeposit>>) {
  if (!d.settlementId) throw new DepositError("Primero empieza la liquidación.");
  const discounts = await tx
    .select({ amount: settlementDiscount.amount, status: settlementDiscount.status })
    .from(settlementDiscount)
    .where(eq(settlementDiscount.settlementId, d.settlementId));
  const [refunded] = await tx
    .select({ total: sql<string>`coalesce(sum(${depositRefund.amount}), 0)::text` })
    .from(depositRefund)
    .where(eq(depositRefund.settlementId, d.settlementId));
  return settle({ deposit: d.amount, discounts, refunded: refunded.total });
}

// Empieza la liquidación (borrador). La garantía pasa a "En liquidación".
export async function startSettlement(tx: Tx, depositId: string) {
  const d = await findDeposit(tx, depositId);
  if (d.status === "none") throw new DepositError("Este contrato no tiene garantía.");
  if (d.settlementId) return d;
  await tx.insert(settlement).values({ depositId });
  await tx.update(deposit).set({ status: "settling" }).where(eq(deposit.id, depositId));
  return d;
}

// Rubros que el residente reportó al ingresar (regla 8) en el contrato de esta garantía.
async function entryAreas(tx: Tx, contractId: string) {
  const rows = await tx
    .select({ area: entryReport.area })
    .from(entryReport)
    .where(eq(entryReport.contractId, contractId));
  return [...new Set(rows.map((r) => r.area))];
}

export async function addDiscount(
  tx: Tx,
  depositId: string,
  data: {
    area: InspectionArea;
    note: string;
    amount: string;
    photoPath: string | null;
    worseThanEntry: boolean;
  },
) {
  const d = await findDeposit(tx, depositId);
  if (!d.settlementId || d.settlementStatus !== "draft") {
    throw new DepositError("Solo se agregan descuentos mientras la liquidación es un borrador.");
  }
  if (data.photoPath && !isFolderPathOf(data.photoPath, d.businessId, d.residentId, "liquidacion")) {
    throw new DepositError("No pudimos usar esa foto. Vuelve a subirla.");
  }
  const problems = discountProblems({
    area: data.area,
    worseThanEntry: data.worseThanEntry,
    hasPhoto: Boolean(data.photoPath),
    entryAreas: await entryAreas(tx, d.contractId),
  });
  if (problems.includes("needs_worse_than_entry")) {
    throw new DepositError(
      "El residente reportó este rubro al ingresar. Solo se descuenta si está peor que al entrar: márcalo.",
    );
  }
  if (problems.includes("needs_photo")) {
    throw new DepositError("Como el residente lo reportó al ingresar, sube una foto de cómo está ahora.");
  }
  await tx.insert(settlementDiscount).values({ settlementId: d.settlementId, ...data });
  return d;
}

export async function deleteDiscount(tx: Tx, discountId: string) {
  const [x] = await tx
    .select({ settlementId: settlementDiscount.settlementId })
    .from(settlementDiscount)
    .where(eq(settlementDiscount.id, discountId))
    .limit(1);
  if (!x) throw new DepositError("No encontramos ese descuento. Recarga la página.");
  const d = await findBySettlement(tx, x.settlementId);
  if (d.settlementStatus !== "draft") {
    throw new DepositError("Ya se envió: en vez de quitarlo, retíralo si el residente lo disputa.");
  }
  await tx.delete(settlementDiscount).where(eq(settlementDiscount.id, discountId));
  return d;
}

// GA-10: el residente ya la ve y puede aceptarla o disputar un descuento.
export async function sendSettlement(tx: Tx, depositId: string) {
  const d = await findDeposit(tx, depositId);
  if (!d.settlementId || d.settlementStatus !== "draft")
    throw new DepositError("Esta liquidación ya se envió.");
  await tx
    .update(settlement)
    .set({ status: "sent", sentAt: new Date() })
    .where(eq(settlement.id, d.settlementId));
  return d;
}

// Responder a una disputa (regla 7): ajustar el monto o retirar el descuento.
export async function answerDispute(
  tx: Tx,
  discountId: string,
  answer: { action: "adjust"; amount: string } | { action: "withdraw" },
) {
  const [x] = await tx
    .select({
      settlementId: settlementDiscount.settlementId,
      status: settlementDiscount.status,
      amount: settlementDiscount.amount,
    })
    .from(settlementDiscount)
    .where(eq(settlementDiscount.id, discountId))
    .limit(1);
  if (!x) throw new DepositError("No encontramos ese descuento. Recarga la página.");
  if (x.status !== "disputed") throw new DepositError("Ese descuento no está en disputa.");
  await tx
    .update(settlementDiscount)
    .set(
      answer.action === "adjust"
        ? { status: "adjusted", amount: answer.amount, originalAmount: x.amount }
        : { status: "withdrawn" },
    )
    .where(eq(settlementDiscount.id, discountId));
  return findBySettlement(tx, x.settlementId);
}

// Cierra si ya no queda nada: sin disputas, todo devuelto y la diferencia (si hay) cobrada o perdonada.
async function closeIfDone(tx: Tx, depositId: string) {
  const d = await findDeposit(tx, depositId);
  if (d.settlementStatus !== "sent") return false;
  const s = await summary(tx, d);
  const excessHandled = Number(s.excess) === 0 || d.excessChargeId !== null || d.excessWaived;
  if (!s.fullyRefunded || !excessHandled) return false;
  await tx
    .update(settlement)
    .set({ status: "closed", closedAt: new Date() })
    .where(eq(settlement.id, d.settlementId!));
  await tx.update(deposit).set({ status: "returned" }).where(eq(deposit.id, depositId));
  return true;
}

// GA-15: registrar lo devuelto. Puede ir en partes; nunca más de lo que ya se puede pagar (lo no disputado).
export async function registerRefund(
  tx: Tx,
  depositId: string,
  data: {
    amount: string;
    method: "yape" | "plin" | "transfer" | "cash" | "card";
    paidOn: string;
    operationCode: string | null;
    proofPath: string | null;
  },
  userId: string,
) {
  const d = await findDeposit(tx, depositId);
  if (d.settlementStatus !== "sent") throw new DepositError("Primero envía la liquidación al residente.");
  if (data.proofPath && !isFolderPathOf(data.proofPath, d.businessId, d.residentId, "devoluciones")) {
    throw new DepositError("No pudimos usar ese comprobante. Vuelve a subirlo.");
  }
  const s = await summary(tx, d);
  if (Number(data.amount) > Number(s.payableNow)) {
    throw new DepositError(
      Number(s.payableNow) === 0
        ? "No queda nada por devolver mientras haya descuentos en disputa."
        : `Como máximo puedes registrar S/ ${s.payableNow}: lo disputado no se paga hasta resolverlo.`,
    );
  }
  const me = await myPersonId(tx, userId);
  await tx.insert(depositRefund).values({ settlementId: d.settlementId!, ...data, registeredBy: me });
  await closeIfDone(tx, depositId);
  return d;
}

// Pregunta 9: lo que los descuentos pasan de la garantía se cobra como un cargo en el recibo de este mes…
export async function chargeExcess(tx: Tx, depositId: string) {
  const d = await findDeposit(tx, depositId);
  if (d.settlementStatus !== "sent") throw new DepositError("Primero envía la liquidación al residente.");
  if (d.excessChargeId || d.excessWaived) throw new DepositError("Ya decidiste qué hacer con la diferencia.");
  const s = await summary(tx, d);
  if (s.hasDisputes) throw new DepositError("Primero resuelve los descuentos en disputa.");
  if (Number(s.excess) === 0) throw new DepositError("Los descuentos no pasan la garantía.");
  const today = limaToday(new Date());
  const [row] = await tx
    .insert(charge)
    .values({
      contractId: d.contractId,
      concept: "damages",
      period: periodOf(today),
      amount: s.excess,
      dueDate: today,
      note: "Descuentos de la liquidación que pasan la garantía",
    })
    .returning({ id: charge.id });
  await tx.update(settlement).set({ excessChargeId: row.id }).where(eq(settlement.id, d.settlementId!));
  await closeIfDone(tx, depositId);
  return d;
}

// …o el arrendador la perdona.
export async function waiveExcess(tx: Tx, depositId: string) {
  const d = await findDeposit(tx, depositId);
  if (d.settlementStatus !== "sent") throw new DepositError("Primero envía la liquidación al residente.");
  if (d.excessChargeId) throw new DepositError("La diferencia ya se cobró en un recibo.");
  await tx.update(settlement).set({ excessWaived: true }).where(eq(settlement.id, d.settlementId!));
  await closeIfDone(tx, depositId);
  return d;
}

// Cerrar a mano (por ejemplo, cuando no hay nada que devolver ni cobrar).
export async function closeSettlement(tx: Tx, depositId: string) {
  const closed = await closeIfDone(tx, depositId);
  if (!closed) {
    throw new DepositError(
      "Todavía no se puede cerrar: falta devolver, resolver una disputa o decidir qué hacer con la diferencia.",
    );
  }
  return findDeposit(tx, depositId);
}

// Regla 8 / pregunta 10: el residente reporta lo que ya estaba mal, con foto. El RLS revisa que sea su contrato y
// que siga dentro del plazo (función entry_report_open).
export async function addEntryReport(tx: Tx, data: EntryReportInput & { photoPath: string }, userId: string) {
  const [c] = await tx
    .select({ residentId: contract.residentId, businessId: resident.businessId })
    .from(contract)
    .innerJoin(resident, eq(resident.id, contract.residentId))
    .where(eq(contract.id, data.contractId))
    .limit(1);
  if (!c) throw new DepositError("No encontramos tu contrato. Recarga la página.");
  if (!isFolderPathOf(data.photoPath, c.businessId, c.residentId, "ingreso")) {
    throw new DepositError("No pudimos usar esa foto. Vuelve a subirla.");
  }
  const [open] = (await tx.execute(
    sql`select public.entry_report_open(${data.contractId}) as open`,
  )) as unknown as { open: boolean }[];
  if (!open?.open) throw new DepositError("El plazo para reportar lo que ya estaba mal terminó.");
  const me = await myPersonId(tx, userId);
  await tx.insert(entryReport).values({ ...data, reportedBy: me });
  return c;
}

// El residente responde su liquidación y disputa descuentos con funciones de la base (migración 0010).
export async function respondSettlement(
  tx: Tx,
  settlementId: string,
  data: { method: string; account: string; accept: boolean },
) {
  const [row] = (await tx.execute(
    sql`select public.respond_settlement(${settlementId}, ${data.method}::public.payment_method, ${data.account}, ${data.accept}) as ok`,
  )) as unknown as { ok: boolean }[];
  if (!row?.ok) throw new DepositError("No pudimos guardar tu respuesta. Recarga la página.");
}

export async function disputeDiscount(tx: Tx, discountId: string, reason: string) {
  const [row] = (await tx.execute(
    sql`select public.dispute_discount(${discountId}, ${reason}) as ok`,
  )) as unknown as { ok: boolean }[];
  if (!row?.ok) throw new DepositError("Ese descuento ya no se puede disputar. Recarga la página.");
}
