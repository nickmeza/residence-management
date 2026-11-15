import "server-only";

import { and, asc, eq, inArray, isNotNull } from "drizzle-orm";

import { withRls } from "@/db/rls";
import {
  business,
  floor,
  maintenanceRequest,
  pensionPayment,
  pensionPlan,
  pensionSubscription,
  property,
  unit,
  contract,
  resident,
} from "@/db/schema";
import { getSessionClaims } from "@/server/auth/session";
import { floorName } from "@/server/building/floors";
import { isUuid } from "@/server/business/queries";
import { limaToday } from "@/server/contracts/dates";
import { toCents, fromCents } from "@/server/payments/money";
import { buildReceipts, loadBusiness } from "@/server/payments/queries";
import { periodOf } from "@/server/payments/rules";

import {
  financeByMonth,
  lastPeriods,
  occupancyByFloor,
  occupancyByMonth,
  pensionByMonth,
  type FinanceRow,
  type OccupancyRow,
} from "./rules";

type Tx = Parameters<Parameters<typeof withRls>[1]>[0];

export const REPORT_MONTHS = 6;

export type ResidenceReport = {
  kind: "residence";
  tradeName: string;
  floors: OccupancyRow[];
  monthly: { period: string; percent: number }[];
  finance: FinanceRow[];
  overdue: { total: string; residents: number };
};

export type PensionReport = {
  kind: "meal_plan";
  tradeName: string;
  monthly: { period: string; collected: string; diners: number }[];
};

// Costo de mantenimiento por mes (pedidos resueltos). Sin la migración 0021, no hay costos.
async function maintenanceCosts(tx: Tx, businessId: string) {
  try {
    const rows = await tx.transaction((sp) =>
      sp
        .select({ cost: maintenanceRequest.cost, resolvedAt: maintenanceRequest.resolvedAt })
        .from(maintenanceRequest)
        .where(
          and(
            eq(maintenanceRequest.businessId, businessId),
            eq(maintenanceRequest.status, "done"),
            isNotNull(maintenanceRequest.cost),
          ),
        ),
    );
    return rows.map((r) => ({ period: periodOf(limaToday(r.resolvedAt!)), amount: r.cost! }));
  } catch {
    return [];
  }
}

async function residenceReport(tx: Tx, businessId: string, tradeName: string): Promise<ResidenceReport> {
  const today = limaToday(new Date());
  const periods = lastPeriods(periodOf(today), REPORT_MONTHS);
  const [units, contracts, data, costs] = await Promise.all([
    tx
      .select({
        id: unit.id,
        type: unit.type,
        parentId: unit.parentUnitId,
        rentalMode: unit.rentalMode,
        level: floor.level,
        propertyName: property.name,
      })
      .from(unit)
      .innerJoin(floor, eq(floor.id, unit.floorId))
      .innerJoin(property, eq(property.id, floor.propertyId))
      .where(eq(property.businessId, businessId))
      .orderBy(asc(property.name), asc(floor.level)),
    tx
      .select({
        unitId: contract.unitId,
        startDate: contract.startDate,
        endDate: contract.endDate,
        status: contract.status,
      })
      .from(contract)
      .where(
        inArray(
          contract.residentId,
          tx.select({ id: resident.id }).from(resident).where(eq(resident.businessId, businessId)),
        ),
      ),
    loadBusiness(tx, businessId),
    maintenanceCosts(tx, businessId),
  ]);
  const many = new Set(units.map((u) => u.propertyName)).size > 1;
  const reportUnits = units.map((u) => ({
    ...u,
    floorLabel: many ? `${u.propertyName} · ${floorName(u.level)}` : floorName(u.level),
  }));
  const names = new Map(data.residents.map((r) => [r.id, r.name]));
  const overdue = buildReceipts(data.charges, data.payments, names, today).filter(
    (r) => r.status === "overdue",
  );
  return {
    kind: "residence",
    tradeName,
    floors: occupancyByFloor(reportUnits, contracts, today),
    monthly: occupancyByMonth(reportUnits, contracts, periods, today),
    finance: financeByMonth(periods, data.charges, data.payments, costs),
    overdue: {
      total: fromCents(overdue.reduce((t, r) => t + toCents(r.balance), 0)),
      residents: new Set(overdue.map((r) => r.residentId)).size,
    },
  };
}

async function pensionReport(tx: Tx, businessId: string, tradeName: string): Promise<PensionReport> {
  const periods = lastPeriods(periodOf(limaToday(new Date())), REPORT_MONTHS);
  const subs = await tx
    .select({
      id: pensionSubscription.id,
      residentId: pensionSubscription.residentId,
      startDate: pensionSubscription.startDate,
      endDate: pensionSubscription.endDate,
    })
    .from(pensionSubscription)
    .innerJoin(pensionPlan, eq(pensionPlan.id, pensionSubscription.planId))
    .where(eq(pensionPlan.businessId, businessId));
  const payments = subs.length
    ? await tx
        .select({
          paidOn: pensionPayment.paidOn,
          amount: pensionPayment.amount,
          status: pensionPayment.status,
        })
        .from(pensionPayment)
        .where(
          inArray(
            pensionPayment.subscriptionId,
            subs.map((s) => s.id),
          ),
        )
    : [];
  return { kind: "meal_plan", tradeName, monthly: pensionByMonth(periods, payments, subs) };
}

// Reporte del negocio elegido (los últimos 6 meses). null si no es de quien inició sesión.
export async function getReport(businessId: string): Promise<ResidenceReport | PensionReport | null> {
  if (!isUuid(businessId)) return null;
  const claims = await getSessionClaims();
  return withRls(claims, async (tx) => {
    const [b] = await tx
      .select({ service: business.service, tradeName: business.tradeName })
      .from(business)
      .where(eq(business.id, businessId))
      .limit(1);
    if (!b) return null;
    return b.service === "residence"
      ? residenceReport(tx, businessId, b.tradeName)
      : pensionReport(tx, businessId, b.tradeName);
  });
}
