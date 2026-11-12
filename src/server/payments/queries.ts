import "server-only";

import { and, asc, desc, eq } from "drizzle-orm";

import { withRls } from "@/db/rls";
import { business, charge, contract, payment, person, resident, unit } from "@/db/schema";
import { getSessionClaims } from "@/server/auth/session";
import { isUuid } from "@/server/business/queries";
import { limaToday } from "@/server/contracts/dates";

import { syncBusinessBilling } from "./billing";
import { toCents } from "./money";
import { periodOf, proofMismatch, receiptSummary, type ChargeConcept } from "./rules";

// Lo que ve el arrendador en Cobros (PG-01, PG-04, PG-09) y en el detalle de un recibo (PG-02).
// Un recibo = todo lo que un residente le debe a este negocio en un mes. No es una tabla: sale de los cargos.

type Tx = Parameters<Parameters<typeof withRls>[1]>[0];

export type ChargeRow = {
  id: string;
  contractId: string;
  concept: ChargeConcept;
  period: string;
  amount: string;
  dueDate: string;
  note: string | null;
  unitName: string;
};

export type PaymentRow = {
  id: string;
  period: string;
  amount: string;
  method: "yape" | "plin" | "transfer" | "cash" | "card";
  paidOn: string;
  operationCode: string | null;
  hasProof: boolean;
  status: "in_review" | "confirmed" | "rejected";
  rejectionReason: string | null;
  createdAt: Date;
  // true si lo mandó el residente (no el arrendador).
  fromResident: boolean;
};

export type Receipt = {
  residentId: string;
  residentName: string;
  period: string;
  units: string[];
  charges: ChargeRow[];
  payments: PaymentRow[];
  inReview: number;
} & ReturnType<typeof receiptSummary>;

const paymentColumns = {
  id: payment.id,
  residentId: payment.residentId,
  period: payment.period,
  amount: payment.amount,
  method: payment.method,
  paidOn: payment.paidOn,
  operationCode: payment.operationCode,
  proofPath: payment.proofPath,
  status: payment.status,
  rejectionReason: payment.rejectionReason,
  createdAt: payment.createdAt,
  submittedBy: payment.submittedBy,
  residentPersonId: resident.personId,
};

type RawPayment = Omit<PaymentRow, "hasProof" | "fromResident"> & {
  proofPath: string | null;
  submittedBy: string;
  residentPersonId: string;
};

const toPaymentRow = (p: RawPayment): PaymentRow => ({
  id: p.id,
  period: p.period,
  amount: p.amount,
  method: p.method,
  paidOn: p.paidOn,
  operationCode: p.operationCode,
  hasProof: p.proofPath !== null,
  status: p.status,
  rejectionReason: p.rejectionReason,
  createdAt: p.createdAt,
  fromResident: p.submittedBy === p.residentPersonId,
});

// Arma los recibos con los cargos y pagos que se le pasen (de un negocio, o de un residente).
export function buildReceipts(
  charges: (ChargeRow & { residentId: string; residentName: string })[],
  payments: (PaymentRow & { residentId: string })[],
  names: Map<string, string>,
  today: string,
): Receipt[] {
  const keys = new Map<string, { residentId: string; period: string }>();
  for (const c of charges)
    keys.set(`${c.residentId}|${c.period}`, { residentId: c.residentId, period: c.period });
  for (const p of payments)
    keys.set(`${p.residentId}|${p.period}`, { residentId: p.residentId, period: p.period });
  return [...keys.values()].map(({ residentId, period }) => {
    const own = charges.filter((c) => c.residentId === residentId && c.period === period);
    const paid = payments.filter((p) => p.residentId === residentId && p.period === period);
    return {
      residentId,
      residentName: names.get(residentId) ?? "",
      period,
      units: [...new Set(own.filter((c) => c.concept === "rent").map((c) => c.unitName))],
      charges: own.sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
      payments: paid.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
      inReview: paid.filter((p) => p.status === "in_review").length,
      ...receiptSummary({
        charges: own,
        confirmedPayments: paid.filter((p) => p.status === "confirmed"),
        today,
      }),
    };
  });
}

// Cargos y pagos de los residentes de un negocio (opcional: solo de un residente).
async function loadBusiness(tx: Tx, businessId: string, residentId?: string) {
  const where = residentId
    ? and(eq(resident.businessId, businessId), eq(resident.id, residentId))
    : eq(resident.businessId, businessId);
  const [charges, payments, residents] = await Promise.all([
    tx
      .select({
        id: charge.id,
        contractId: charge.contractId,
        concept: charge.concept,
        period: charge.period,
        amount: charge.amount,
        dueDate: charge.dueDate,
        note: charge.note,
        unitName: unit.name,
        residentId: resident.id,
        residentName: person.fullName,
      })
      .from(charge)
      .innerJoin(contract, eq(contract.id, charge.contractId))
      .innerJoin(unit, eq(unit.id, contract.unitId))
      .innerJoin(resident, eq(resident.id, contract.residentId))
      .innerJoin(person, eq(person.id, resident.personId))
      .where(where),
    tx
      .select(paymentColumns)
      .from(payment)
      .innerJoin(resident, eq(resident.id, payment.residentId))
      .where(where)
      .orderBy(desc(payment.createdAt)),
    tx
      .select({ id: resident.id, name: person.fullName })
      .from(resident)
      .innerJoin(person, eq(person.id, resident.personId))
      .where(where)
      .orderBy(asc(person.fullName)),
  ]);
  return {
    charges,
    payments: payments.map((p) => ({ ...toPaymentRow(p), residentId: p.residentId, proofPath: p.proofPath })),
    residents,
  };
}

export type CollectionsView = {
  tradeName: string;
  businessId: string;
  period: string;
  currentPeriod: string;
  receipts: Receipt[];
  stats: { total: string; collected: string; pending: string; overdue: string; overdueResidents: number };
  delinquent: {
    residentId: string;
    residentName: string;
    owed: string;
    daysLate: number;
    periods: string[];
  }[];
  toReview: (PaymentRow & { residentId: string; residentName: string; balance: string; mismatch: boolean })[];
  residents: { id: string; name: string }[];
};

const sum = (values: string[]) => values.reduce((t, v) => t + toCents(v), 0);
const cents = (n: number) => (n / 100).toFixed(2);

export async function getCollections(
  businessId: string,
  requested?: string,
): Promise<CollectionsView | null> {
  if (!isUuid(businessId)) return null;
  const claims = await getSessionClaims();
  const today = limaToday(new Date());
  const currentPeriod = periodOf(today);
  const period = requested && /^\d{4}-(0[1-9]|1[0-2])$/.test(requested) ? requested : currentPeriod;
  return withRls(claims, async (tx) => {
    const [b] = await tx
      .select({ tradeName: business.tradeName })
      .from(business)
      .where(eq(business.id, businessId))
      .limit(1);
    if (!b) return null;
    // Crea lo que falte (contratos de antes de la Fase 5, meses nuevos de los contratos mes a mes).
    await syncBusinessBilling(tx, businessId);
    const data = await loadBusiness(tx, businessId);
    const names = new Map(data.residents.map((r) => [r.id, r.name]));
    const all = buildReceipts(data.charges, data.payments, names, today);
    const receipts = all
      .filter((r) => r.period === period)
      .sort((a, b) => a.residentName.localeCompare(b.residentName));

    const overdue = all.filter((r) => r.status === "overdue");
    const byResident = new Map<string, Receipt[]>();
    for (const r of overdue) byResident.set(r.residentId, [...(byResident.get(r.residentId) ?? []), r]);
    const delinquent = [...byResident.entries()]
      .map(([residentId, list]) => ({
        residentId,
        residentName: names.get(residentId) ?? "",
        owed: cents(sum(list.map((r) => r.balance))),
        daysLate: Math.max(...list.map((r) => r.daysLate)),
        periods: list.map((r) => r.period).sort(),
      }))
      .sort((a, b) => b.daysLate - a.daysLate);

    const receiptOf = (residentId: string, p: string) =>
      all.find((r) => r.residentId === residentId && r.period === p);
    const toReview = data.payments
      .filter((p) => p.status === "in_review")
      .map((p) => {
        const balance = receiptOf(p.residentId, p.period)?.balance ?? "0.00";
        return {
          ...p,
          residentName: names.get(p.residentId) ?? "",
          balance,
          mismatch: proofMismatch(p.amount, balance),
        };
      });

    const overdueThisMonth = receipts.filter((r) => r.status === "overdue");
    return {
      tradeName: b.tradeName,
      businessId,
      period,
      currentPeriod,
      receipts,
      stats: {
        total: cents(sum(receipts.map((r) => r.total))),
        collected: cents(sum(receipts.map((r) => r.paid))),
        pending: cents(sum(receipts.filter((r) => r.status !== "overdue").map((r) => r.balance))),
        overdue: cents(sum(overdueThisMonth.map((r) => r.balance))),
        overdueResidents: overdueThisMonth.length,
      },
      delinquent,
      toReview,
      residents: data.residents,
    };
  });
}

export type ReceiptView = Receipt & {
  businessId: string;
  tradeName: string;
  // Otros meses con recibo de este residente, para moverse entre ellos.
  periods: string[];
};

// Detalle de un recibo para el arrendador. null si el residente no es de sus negocios.
export async function getReceipt(residentId: string, period: string): Promise<ReceiptView | null> {
  if (!isUuid(residentId) || !/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) return null;
  const claims = await getSessionClaims();
  const today = limaToday(new Date());
  return withRls(claims, async (tx) => {
    const [card] = await tx
      .select({ businessId: resident.businessId, tradeName: business.tradeName, name: person.fullName })
      .from(resident)
      .innerJoin(business, eq(business.id, resident.businessId))
      .innerJoin(person, eq(person.id, resident.personId))
      .where(eq(resident.id, residentId))
      .limit(1);
    if (!card) return null;
    const data = await loadBusiness(tx, card.businessId, residentId);
    const names = new Map([[residentId, card.name]]);
    const all = buildReceipts(data.charges, data.payments, names, today);
    // Un mes sin cargos ni pagos se muestra vacío (por ejemplo, al cambiar de mes desde la dirección).
    const found = all.find((r) => r.period === period) ?? {
      ...receiptSummary({ charges: [], confirmedPayments: [], today }),
      residentId,
      residentName: card.name,
      period,
      units: [],
      charges: [],
      payments: [],
      inReview: 0,
    };
    return {
      ...found,
      businessId: card.businessId,
      tradeName: card.tradeName,
      periods: all.map((r) => r.period).sort(),
    };
  });
}
