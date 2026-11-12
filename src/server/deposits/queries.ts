import "server-only";

import { asc, desc, eq, inArray } from "drizzle-orm";

import { withRls } from "@/db/rls";
import {
  business,
  contract,
  deposit,
  depositRefund,
  depositSettings,
  entryReport,
  person,
  resident,
  settlement,
  settlementDiscount,
  unit,
} from "@/db/schema";
import { getSessionClaims } from "@/server/auth/session";
import { isUuid } from "@/server/business/queries";
import { endsInLabel, limaToday } from "@/server/contracts/dates";
import { contractPhase, type ContractPhase } from "@/server/contracts/rules";
import { syncBusinessBilling } from "@/server/payments/billing";
import { toCents } from "@/server/payments/money";
import { coveredCharges, loadBusiness } from "@/server/payments/queries";
import { periodOf } from "@/server/payments/rules";

import {
  depositPhase,
  settlement as settle,
  type DepositPhase,
  type DepositRule,
  type DiscountStatus,
  type InspectionArea,
} from "./rules";

// Garantías del arrendador (GA-07) y el detalle para liquidar (GA-08 a GA-15).

type Tx = Parameters<Parameters<typeof withRls>[1]>[0];

export type DepositListRow = {
  id: string;
  residentId: string;
  residentName: string;
  unitName: string;
  amount: string;
  phase: DepositPhase;
  contractPhase: ContractPhase;
  endsIn: string;
  refunded: string;
};

export type DepositsView = {
  tradeName: string;
  rows: DepositListRow[];
  stats: {
    held: string;
    heldCount: number;
    toSettle: number;
    returnedThisMonth: string;
    returnedCount: number;
  };
};

async function refundsBy(tx: Tx, settlementIds: string[]) {
  if (!settlementIds.length) return [];
  return tx
    .select({
      id: depositRefund.id,
      settlementId: depositRefund.settlementId,
      amount: depositRefund.amount,
      method: depositRefund.method,
      paidOn: depositRefund.paidOn,
      operationCode: depositRefund.operationCode,
      proofPath: depositRefund.proofPath,
    })
    .from(depositRefund)
    .where(inArray(depositRefund.settlementId, settlementIds))
    .orderBy(asc(depositRefund.paidOn));
}

async function discountsBy(tx: Tx, settlementIds: string[]) {
  if (!settlementIds.length) return [];
  return tx
    .select({
      id: settlementDiscount.id,
      settlementId: settlementDiscount.settlementId,
      area: settlementDiscount.area,
      note: settlementDiscount.note,
      amount: settlementDiscount.amount,
      originalAmount: settlementDiscount.originalAmount,
      photoPath: settlementDiscount.photoPath,
      worseThanEntry: settlementDiscount.worseThanEntry,
      status: settlementDiscount.status,
      disputeReason: settlementDiscount.disputeReason,
    })
    .from(settlementDiscount)
    .where(inArray(settlementDiscount.settlementId, settlementIds))
    .orderBy(asc(settlementDiscount.createdAt));
}

const sumOf = (values: string[]) => (values.reduce((t, v) => t + toCents(v), 0) / 100).toFixed(2);

export async function listDeposits(businessId: string): Promise<DepositsView | null> {
  if (!isUuid(businessId)) return null;
  const claims = await getSessionClaims();
  const today = limaToday(new Date());
  return withRls(claims, async (tx) => {
    const [b] = await tx
      .select({ tradeName: business.tradeName })
      .from(business)
      .where(eq(business.id, businessId))
      .limit(1);
    if (!b) return null;
    // Crea las garantías que falten (contratos confirmados antes de la Fase 5).
    await syncBusinessBilling(tx, businessId);
    const rows = await tx
      .select({
        id: deposit.id,
        amount: deposit.amount,
        status: deposit.status,
        chargeId: deposit.chargeId,
        residentId: resident.id,
        residentName: person.fullName,
        unitName: unit.name,
        startDate: contract.startDate,
        endDate: contract.endDate,
        contractStatus: contract.status,
        settlementId: settlement.id,
      })
      .from(deposit)
      .innerJoin(contract, eq(contract.id, deposit.contractId))
      .innerJoin(unit, eq(unit.id, contract.unitId))
      .innerJoin(resident, eq(resident.id, contract.residentId))
      .innerJoin(person, eq(person.id, resident.personId))
      .leftJoin(settlement, eq(settlement.depositId, deposit.id))
      .where(eq(resident.businessId, businessId))
      .orderBy(asc(person.fullName));
    const settlementIds = rows.flatMap((r) => (r.settlementId ? [r.settlementId] : []));
    const [refunds, discounts, billing] = await Promise.all([
      refundsBy(tx, settlementIds),
      discountsBy(tx, settlementIds),
      loadBusiness(tx, businessId),
    ]);
    const covered = coveredCharges(billing);
    const list = rows.map((r): DepositListRow => {
      const own = discounts.filter((x) => x.settlementId === r.settlementId);
      const phase = contractPhase(
        { status: r.contractStatus, startDate: r.startDate, endDate: r.endDate },
        today,
      );
      return {
        id: r.id,
        residentId: r.residentId,
        residentName: r.residentName,
        unitName: r.unitName,
        amount: r.amount,
        phase: depositPhase({
          status: r.status,
          chargePaid: r.chargeId !== null && covered.has(r.chargeId),
          hasDisputes: own.some((x) => x.status === "disputed"),
        }),
        contractPhase: phase,
        endsIn: r.endDate ? endsInLabel(r.endDate, today) : "Sin fecha de fin",
        refunded: sumOf(refunds.filter((x) => x.settlementId === r.settlementId).map((x) => x.amount)),
      };
    });
    const held = list.filter((r) => r.phase === "held" || r.phase === "settling" || r.phase === "disputed");
    const month = periodOf(today);
    const returnedThisMonth = refunds.filter((x) => x.paidOn.startsWith(month));
    return {
      tradeName: b.tradeName,
      rows: list,
      stats: {
        held: sumOf(held.map((r) => r.amount)),
        heldCount: held.length,
        // Por liquidar: contratos que terminan pronto o ya terminaron, con la garantía todavía retenida.
        toSettle: list.filter(
          (r) =>
            (r.phase === "held" || r.phase === "settling" || r.phase === "disputed") &&
            (r.contractPhase === "ending_soon" || r.contractPhase === "ended"),
        ).length,
        returnedThisMonth: sumOf(returnedThisMonth.map((x) => x.amount)),
        returnedCount: new Set(returnedThisMonth.map((x) => x.settlementId)).size,
      },
    };
  });
}

export type DiscountRow = {
  id: string;
  area: InspectionArea;
  note: string;
  amount: string;
  originalAmount: string | null;
  hasPhoto: boolean;
  worseThanEntry: boolean;
  status: DiscountStatus;
  disputeReason: string | null;
};

export type EntryReportRow = { id: string; area: InspectionArea; note: string; createdAt: Date };

export type RefundRow = {
  id: string;
  amount: string;
  method: "yape" | "plin" | "transfer" | "cash" | "card";
  paidOn: string;
  operationCode: string | null;
  hasProof: boolean;
};

export type DepositDetail = {
  id: string;
  businessId: string;
  tradeName: string;
  residentId: string;
  residentName: string;
  unitName: string;
  contractId: string;
  startDate: string;
  endDate: string | null;
  contractPhase: ContractPhase;
  amount: string;
  rule: DepositRule;
  phase: DepositPhase;
  refundDays: number;
  refundMethods: ("yape" | "plin" | "transfer" | "cash" | "card")[];
  entryReports: EntryReportRow[];
  settlement: {
    id: string;
    status: "draft" | "sent" | "closed";
    refundMethod: "yape" | "plin" | "transfer" | "cash" | "card" | null;
    refundAccount: string | null;
    sentAt: Date | null;
    acceptedAt: Date | null;
    closedAt: Date | null;
    excessCharged: boolean;
    excessWaived: boolean;
    discounts: DiscountRow[];
    refunds: RefundRow[];
    summary: ReturnType<typeof settle>;
  } | null;
};

// Todo lo de una garantía para el arrendador. null si no es de sus negocios.
export async function getDepositDetail(depositId: string): Promise<DepositDetail | null> {
  if (!isUuid(depositId)) return null;
  const claims = await getSessionClaims();
  const today = limaToday(new Date());
  return withRls(claims, async (tx) => {
    const [d] = await tx
      .select({
        id: deposit.id,
        amount: deposit.amount,
        rule: deposit.rule,
        status: deposit.status,
        chargeId: deposit.chargeId,
        contractId: contract.id,
        startDate: contract.startDate,
        endDate: contract.endDate,
        contractStatus: contract.status,
        residentId: resident.id,
        businessId: resident.businessId,
        tradeName: business.tradeName,
        residentName: person.fullName,
        unitName: unit.name,
      })
      .from(deposit)
      .innerJoin(contract, eq(contract.id, deposit.contractId))
      .innerJoin(unit, eq(unit.id, contract.unitId))
      .innerJoin(resident, eq(resident.id, contract.residentId))
      .innerJoin(business, eq(business.id, resident.businessId))
      .innerJoin(person, eq(person.id, resident.personId))
      .where(eq(deposit.id, depositId))
      .limit(1);
    if (!d) return null;
    const [settings] = await tx
      .select({ refundDays: depositSettings.refundDays, refundMethods: depositSettings.refundMethods })
      .from(depositSettings)
      .where(eq(depositSettings.businessId, d.businessId))
      .limit(1);
    // Los reportes de ingreso de todos los contratos de la ficha que comparten esta garantía (al renovar, la
    // garantía pasa al contrato nuevo, pero lo reportado al ingresar sigue valiendo).
    const contractIds = await tx
      .select({ id: contract.id })
      .from(contract)
      .where(eq(contract.residentId, d.residentId));
    const reports = await tx
      .select({
        id: entryReport.id,
        area: entryReport.area,
        note: entryReport.note,
        createdAt: entryReport.createdAt,
      })
      .from(entryReport)
      .where(
        inArray(
          entryReport.contractId,
          contractIds.map((c) => c.id),
        ),
      )
      .orderBy(desc(entryReport.createdAt));
    const [s] = await tx.select().from(settlement).where(eq(settlement.depositId, d.id)).limit(1);
    const discounts = s ? await discountsBy(tx, [s.id]) : [];
    const refunds = s ? await refundsBy(tx, [s.id]) : [];
    const billing = await loadBusiness(tx, d.businessId, d.residentId);
    const covered = coveredCharges(billing);
    const summary = settle({
      deposit: d.amount,
      discounts,
      refunded: sumOf(refunds.map((r) => r.amount)),
    });
    return {
      id: d.id,
      businessId: d.businessId,
      tradeName: d.tradeName,
      residentId: d.residentId,
      residentName: d.residentName,
      unitName: d.unitName,
      contractId: d.contractId,
      startDate: d.startDate,
      endDate: d.endDate,
      contractPhase: contractPhase(
        { status: d.contractStatus, startDate: d.startDate, endDate: d.endDate },
        today,
      ),
      amount: d.amount,
      rule: d.rule,
      phase: depositPhase({
        status: d.status,
        chargePaid: d.chargeId !== null && covered.has(d.chargeId),
        hasDisputes: summary.hasDisputes,
      }),
      refundDays: settings?.refundDays ?? 7,
      refundMethods: settings?.refundMethods ?? ["yape", "plin", "transfer"],
      entryReports: reports,
      settlement: s
        ? {
            id: s.id,
            status: s.status,
            refundMethod: s.refundMethod,
            refundAccount: s.refundAccount,
            sentAt: s.sentAt,
            acceptedAt: s.acceptedAt,
            closedAt: s.closedAt,
            excessCharged: s.excessChargeId !== null,
            excessWaived: s.excessWaived,
            // Sin la ruta del archivo ni el id de la liquidación: la pantalla solo necesita saber si hay foto.
            discounts: discounts.map((x) => ({
              id: x.id,
              area: x.area,
              note: x.note,
              amount: x.amount,
              originalAmount: x.originalAmount,
              hasPhoto: x.photoPath !== null,
              worseThanEntry: x.worseThanEntry,
              status: x.status,
              disputeReason: x.disputeReason,
            })),
            refunds: refunds.map((x) => ({
              id: x.id,
              amount: x.amount,
              method: x.method,
              paidOn: x.paidOn,
              operationCode: x.operationCode,
              hasProof: x.proofPath !== null,
            })),
            summary,
          }
        : null,
    };
  });
}
