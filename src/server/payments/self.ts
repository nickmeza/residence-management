import "server-only";

import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";

import { withRls } from "@/db/rls";
import {
  charge,
  contract,
  deposit,
  depositRefund,
  depositSettings,
  entryReport,
  payment,
  person,
  resident,
  settlement,
  settlementDiscount,
} from "@/db/schema";
import { getSessionClaims } from "@/server/auth/session";
import { limaToday } from "@/server/contracts/dates";
import {
  canReportEntry,
  depositPhase,
  settlement as settle,
  type DepositPhase,
  type DepositRule,
  type DiscountStatus,
  type InspectionArea,
} from "@/server/deposits/rules";
import { currentContract } from "@/server/residents/list";

import { toCents } from "./money";
import { buildReceipts, type Receipt } from "./queries";
import { coveredChargeIds, periodOf } from "./rules";

// Lo que ve el residente de sus pagos (PG-03, PG-08, PR-02) y de su garantía (GA-04 a GA-14), con su sesión (RLS).
// Puede estar en negocios de dueños distintos: cada uno cobra por separado (regla "recibo único").

type Method = "yape" | "plin" | "transfer" | "cash" | "card";

type PaymentInfo = {
  business_id: string;
  trade_name: string;
  ruc: string | null;
  phone: string | null;
  payment_methods: string | Method[];
};

type Place = { resident_id: string; contract_id: string | null; unit_name: string | null };

// Postgres devuelve los arreglos de enums como texto ("{yape,plin}") cuando llegan por una función.
const methodsOf = (value: string | Method[]): Method[] =>
  Array.isArray(value) ? value : (value.replace(/[{}]/g, "").split(",").filter(Boolean) as Method[]);

async function myCards(tx: Parameters<Parameters<typeof withRls>[1]>[0], userId: string) {
  const [me] = await tx.select({ id: person.id }).from(person).where(eq(person.userId, userId)).limit(1);
  if (!me) return [];
  return tx
    .select({ id: resident.id, businessId: resident.businessId })
    .from(resident)
    .where(eq(resident.personId, me.id));
}

export type MyBilling = {
  residentId: string;
  businessId: string;
  businessName: string;
  ruc: string | null;
  phone: string | null;
  methods: Method[];
  receipts: Receipt[];
  // El recibo a pagar ahora: el más antiguo con saldo hasta este mes, o el de este mes.
  current: Receipt | null;
};

export async function getMyBilling(): Promise<MyBilling[]> {
  const claims = await getSessionClaims();
  const today = limaToday(new Date());
  const thisPeriod = periodOf(today);
  return withRls(claims, async (tx) => {
    const cards = await myCards(tx, claims.sub);
    if (!cards.length) return [];
    const ids = cards.map((c) => c.id);
    const [info, places, charges, payments] = await Promise.all([
      tx.execute(sql`select * from public.my_payment_info()`) as unknown as Promise<PaymentInfo[]>,
      tx.execute(sql`select * from public.my_resident_places()`) as unknown as Promise<Place[]>,
      tx
        .select({
          id: charge.id,
          contractId: charge.contractId,
          concept: charge.concept,
          period: charge.period,
          amount: charge.amount,
          dueDate: charge.dueDate,
          note: charge.note,
          residentId: contract.residentId,
        })
        .from(charge)
        .innerJoin(contract, eq(contract.id, charge.contractId))
        .where(inArray(contract.residentId, ids)),
      tx
        .select({
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
        })
        .from(payment)
        .where(inArray(payment.residentId, ids))
        .orderBy(desc(payment.createdAt)),
    ]);
    const unitOf = new Map(places.map((p) => [p.contract_id, p.unit_name ?? ""]));
    return cards.map((card): MyBilling => {
      const b = info.find((i) => i.business_id === card.businessId);
      const receipts = buildReceipts(
        charges
          .filter((c) => c.residentId === card.id)
          .map((c) => ({ ...c, unitName: unitOf.get(c.contractId) ?? "", residentName: "" })),
        payments
          .filter((p) => p.residentId === card.id)
          .map((p) => ({
            id: p.id,
            residentId: p.residentId,
            period: p.period,
            amount: p.amount,
            method: p.method,
            paidOn: p.paidOn,
            operationCode: p.operationCode,
            hasProof: p.proofPath !== null,
            status: p.status,
            rejectionReason: p.rejectionReason,
            createdAt: p.createdAt,
            fromResident: true,
          })),
        new Map(),
        today,
      ).sort((a, b) => b.period.localeCompare(a.period));
      const owing = receipts
        .filter((r) => r.status !== "paid" && r.period <= thisPeriod)
        .sort((a, b) => a.period.localeCompare(b.period));
      return {
        residentId: card.id,
        businessId: card.businessId,
        businessName: b?.trade_name ?? "Tu residencia",
        ruc: b?.ruc ?? null,
        phone: b?.phone ?? null,
        methods: methodsOf(b?.payment_methods ?? []),
        receipts,
        current: owing[0] ?? receipts.find((r) => r.period === thisPeriod) ?? null,
      };
    });
  });
}

export type MyDeposit = {
  residentId: string;
  businessId: string;
  businessName: string;
  amount: string;
  rule: DepositRule;
  phase: DepositPhase;
  startDate: string;
  endDate: string | null;
  covers: InspectionArea[];
  refundDays: number;
  refundMethods: Method[];
  // Para reportar lo que ya estaba mal: el contrato y si sigue en plazo.
  contractId: string;
  canReport: boolean;
  reportUntil: string;
  entryReports: { id: string; area: InspectionArea; note: string; createdAt: Date }[];
  settlement: {
    id: string;
    status: "sent" | "closed";
    refundMethod: Method | null;
    refundAccount: string | null;
    acceptedAt: Date | null;
    excessCharged: boolean;
    excessWaived: boolean;
    discounts: {
      id: string;
      area: InspectionArea;
      note: string;
      amount: string;
      originalAmount: string | null;
      hasPhoto: boolean;
      status: DiscountStatus;
      disputeReason: string | null;
    }[];
    refunds: { id: string; amount: string; method: Method; paidOn: string }[];
    summary: ReturnType<typeof settle>;
  } | null;
};

export async function getMyDeposits(): Promise<{ businessName: string; deposit: MyDeposit | null }[]> {
  const claims = await getSessionClaims();
  const today = limaToday(new Date());
  return withRls(claims, async (tx) => {
    const cards = await myCards(tx, claims.sub);
    if (!cards.length) return [];
    const ids = cards.map((c) => c.id);
    const [info, contracts, deposits, settings] = await Promise.all([
      tx.execute(sql`select * from public.my_payment_info()`) as unknown as Promise<PaymentInfo[]>,
      tx
        .select({
          id: contract.id,
          residentId: contract.residentId,
          unitId: contract.unitId,
          startDate: contract.startDate,
          endDate: contract.endDate,
          status: contract.status,
        })
        .from(contract)
        .where(inArray(contract.residentId, ids)),
      tx
        .select({
          id: deposit.id,
          contractId: deposit.contractId,
          amount: deposit.amount,
          rule: deposit.rule,
          status: deposit.status,
          chargeId: deposit.chargeId,
        })
        .from(deposit)
        .innerJoin(contract, eq(contract.id, deposit.contractId))
        .where(inArray(contract.residentId, ids)),
      tx
        .select()
        .from(depositSettings)
        .where(
          inArray(
            depositSettings.businessId,
            cards.map((c) => c.businessId),
          ),
        ),
    ]);
    const contractIds = contracts.map((c) => c.id);
    const [reports, settlements, charges, confirmed] = await Promise.all([
      contractIds.length
        ? tx
            .select({
              id: entryReport.id,
              contractId: entryReport.contractId,
              area: entryReport.area,
              note: entryReport.note,
              createdAt: entryReport.createdAt,
            })
            .from(entryReport)
            .where(inArray(entryReport.contractId, contractIds))
            .orderBy(asc(entryReport.createdAt))
        : [],
      // El RLS no le muestra los borradores.
      deposits.length
        ? tx
            .select()
            .from(settlement)
            .where(
              inArray(
                settlement.depositId,
                deposits.map((d) => d.id),
              ),
            )
        : [],
      contractIds.length
        ? tx
            .select({
              id: charge.id,
              period: charge.period,
              amount: charge.amount,
              dueDate: charge.dueDate,
              residentId: contract.residentId,
            })
            .from(charge)
            .innerJoin(contract, eq(contract.id, charge.contractId))
            .where(inArray(charge.contractId, contractIds))
        : [],
      tx
        .select({ residentId: payment.residentId, period: payment.period, amount: payment.amount })
        .from(payment)
        .where(and(inArray(payment.residentId, ids), eq(payment.status, "confirmed"))),
    ]);
    const settlementIds = settlements.map((s) => s.id);
    const [discounts, refunds] = settlementIds.length
      ? await Promise.all([
          tx
            .select()
            .from(settlementDiscount)
            .where(inArray(settlementDiscount.settlementId, settlementIds))
            .orderBy(asc(settlementDiscount.createdAt)),
          tx
            .select()
            .from(depositRefund)
            .where(inArray(depositRefund.settlementId, settlementIds))
            .orderBy(asc(depositRefund.paidOn)),
        ])
      : [[], []];

    return cards.map((card) => {
      const businessName = info.find((i) => i.business_id === card.businessId)?.trade_name ?? "Tu residencia";
      const own = contracts.filter((c) => c.residentId === card.id && c.status !== "draft");
      const shown = currentContract(own, today);
      // La garantía vive en el contrato de ahora (al renovar pasa al nuevo) o en el último que la tuvo.
      const d =
        deposits.find((x) => x.contractId === shown?.id) ??
        deposits.find((x) => own.some((c) => c.id === x.contractId));
      if (!d || !shown) return { businessName, deposit: null };
      const c = own.find((x) => x.id === d.contractId) ?? shown;
      const s = settlements.find((x) => x.depositId === d.id);
      const sDiscounts = discounts.filter((x) => x.settlementId === s?.id);
      const sRefunds = refunds.filter((x) => x.settlementId === s?.id);
      const summary = settle({
        deposit: d.amount,
        discounts: sDiscounts,
        refunded: (sRefunds.reduce((t, r) => t + toCents(r.amount), 0) / 100).toFixed(2),
      });
      const cfg = settings.find((x) => x.businessId === card.businessId);
      const windowDays = cfg?.entryReportDays ?? 7;
      // ¿Ya se pagó el cargo de la garantía? Se mira su recibo, aplicando los pagos en orden de vencimiento.
      const depositCharge = charges.find((x) => x.id === d.chargeId);
      const chargePaid = depositCharge
        ? coveredChargeIds(
            charges.filter((x) => x.residentId === card.id && x.period === depositCharge.period),
            confirmed.filter((p) => p.residentId === card.id && p.period === depositCharge.period),
          ).has(depositCharge.id)
        : false;
      const until = new Date(Date.parse(`${c.startDate}T00:00:00Z`) + windowDays * 86_400_000)
        .toISOString()
        .slice(0, 10);
      return {
        businessName,
        deposit: {
          residentId: card.id,
          businessId: card.businessId,
          businessName,
          amount: d.amount,
          rule: d.rule,
          phase: depositPhase({ status: d.status, chargePaid, hasDisputes: summary.hasDisputes }),
          startDate: c.startDate,
          endDate: c.endDate,
          covers: cfg?.covers ?? ["walls", "door", "window", "furniture", "keys", "cleaning"],
          refundDays: cfg?.refundDays ?? 7,
          refundMethods: cfg?.refundMethods ?? ["yape", "plin", "transfer"],
          contractId: shown.id,
          canReport:
            (shown.status === "confirmed" || shown.status === "pending_signature") &&
            canReportEntry({ startDate: shown.startDate, today, windowDays }),
          reportUntil: until,
          entryReports: reports
            .filter((r) => own.some((o) => o.id === r.contractId))
            .map((r) => ({ id: r.id, area: r.area, note: r.note, createdAt: r.createdAt })),
          settlement:
            s && s.status !== "draft"
              ? {
                  id: s.id,
                  status: s.status,
                  refundMethod: s.refundMethod,
                  refundAccount: s.refundAccount,
                  acceptedAt: s.acceptedAt,
                  excessCharged: s.excessChargeId !== null,
                  excessWaived: s.excessWaived,
                  discounts: sDiscounts.map((x) => ({
                    id: x.id,
                    area: x.area,
                    note: x.note,
                    amount: x.amount,
                    originalAmount: x.originalAmount,
                    hasPhoto: x.photoPath !== null,
                    status: x.status,
                    disputeReason: x.disputeReason,
                  })),
                  refunds: sRefunds.map((x) => ({
                    id: x.id,
                    amount: x.amount,
                    method: x.method,
                    paidOn: x.paidOn,
                  })),
                  summary,
                }
              : null,
        },
      };
    });
  });
}
