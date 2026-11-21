import "server-only";

import { and, eq, inArray, isNull, lte, notExists, sql, type SQLWrapper } from "drizzle-orm";

import { withRls } from "@/db/rls";
import {
  application,
  business,
  cleaningRequest,
  contract,
  deposit,
  document,
  floor,
  maintenanceRequest,
  message,
  parcel,
  pensionPayment,
  pensionPlan,
  pensionSubscription,
  person,
  property,
  recurringTask,
  resident,
  settlement,
  settlementDiscount,
  unit,
} from "@/db/schema";
import { getSessionClaims } from "@/server/auth/session";
import { addDays, limaToday } from "@/server/contracts/dates";
import { movesIn } from "@/server/moves/queries";
import { buildReceipts, loadBusiness } from "@/server/payments/queries";
import { pendingMovesSoon } from "@/server/moves/rules";
import { getMyBilling, getMyDeposits } from "@/server/payments/self";
import { getMyResidences } from "@/server/residents/self";
import { listMyReviewables } from "@/server/reviews/queries";
import { DUE_SOON_DAYS } from "@/server/tasks/rules";

import {
  businessDaysLeft,
  landlordPending,
  residentPending,
  type LandlordCounts,
  type PendingItem,
} from "./pending";

type Tx = Parameters<Parameters<typeof withRls>[1]>[0];

const count = sql<number>`count(*)::int`;

// Una cuenta como columna de otra consulta. Desde Lima cada viaje a la base tarda ~100 ms, así que todas las cuentas
// van juntas en una sola consulta en lugar de una tras otra.
function scalar(query: SQLWrapper) {
  return sql<number>`(${query})`.mapWith(Number);
}

async function residenceCounts(tx: Tx, businessId: string): Promise<Partial<LandlordCounts>> {
  const residentIds = tx
    .select({ id: resident.id })
    .from(resident)
    .where(eq(resident.businessId, businessId));
  const contractIds = tx
    .select({ id: contract.id })
    .from(contract)
    .where(inArray(contract.residentId, residentIds));
  const today = limaToday(new Date());
  const activeMaintenance = and(
    eq(maintenanceRequest.businessId, businessId),
    inArray(maintenanceRequest.status, ["open", "in_progress"]),
  );
  const activeTasks = and(eq(recurringTask.businessId, businessId), eq(recurringTask.active, true));

  // Las tres van a la vez por la misma conexión.
  const [[counts], data, moves] = await Promise.all([
    tx
      .select({
        documentsToReview: scalar(
          tx
            .select({ n: count })
            .from(document)
            .where(and(eq(document.status, "in_review"), inArray(document.residentId, residentIds))),
        ),
        disputedDiscounts: scalar(
          tx
            .select({ n: count })
            .from(settlementDiscount)
            .innerJoin(settlement, eq(settlement.id, settlementDiscount.settlementId))
            .innerJoin(deposit, eq(deposit.id, settlement.depositId))
            .where(and(eq(settlementDiscount.status, "disputed"), inArray(deposit.contractId, contractIds))),
        ),
        contractsToSign: scalar(
          tx
            .select({ n: count })
            .from(contract)
            .where(and(eq(contract.status, "pending_signature"), inArray(contract.residentId, residentIds))),
        ),
        openMaintenance: scalar(tx.select({ n: count }).from(maintenanceRequest).where(activeMaintenance)),
        urgentMaintenance: scalar(
          tx
            .select({ n: count })
            .from(maintenanceRequest)
            .where(and(activeMaintenance, eq(maintenanceRequest.priority, "urgent"))),
        ),
        newApplications: scalar(
          tx
            .select({ n: count })
            .from(application)
            .where(and(eq(application.businessId, businessId), eq(application.status, "new"))),
        ),
        unreadMessages: scalar(unreadFor(tx, businessId)),
        // Sin cuarto: ningún contrato pendiente de firma ni confirmado (los borradores no cuentan).
        residentsWithoutRoom: scalar(
          tx
            .select({ n: count })
            .from(resident)
            .where(
              and(
                eq(resident.businessId, businessId),
                notExists(
                  tx
                    .select({ id: contract.id })
                    .from(contract)
                    .where(
                      and(
                        eq(contract.residentId, resident.id),
                        inArray(contract.status, ["pending_signature", "confirmed"]),
                      ),
                    ),
                ),
              ),
            ),
        ),
        tasksDue: scalar(
          tx
            .select({ n: count })
            .from(recurringTask)
            .where(and(activeTasks, lte(recurringTask.nextDue, addDays(today, DUE_SOON_DAYS)))),
        ),
        tasksLate: scalar(
          tx
            .select({ n: count })
            .from(recurringTask)
            .where(and(activeTasks, sql`${recurringTask.nextDue} < ${today}`)),
        ),
        cleaningRequests: scalar(
          tx
            .select({ n: count })
            .from(cleaningRequest)
            .where(and(eq(cleaningRequest.businessId, businessId), eq(cleaningRequest.status, "requested"))),
        ),
        dirtyUnits: scalar(
          tx
            .select({ n: count })
            .from(unit)
            .innerJoin(floor, eq(floor.id, unit.floorId))
            .innerJoin(property, eq(property.id, floor.propertyId))
            .where(and(eq(property.businessId, businessId), eq(unit.cleaningStatus, "dirty"))),
        ),
      })
      .from(business)
      .where(eq(business.id, businessId)),
    loadBusiness(tx, businessId),
    movesIn(tx, businessId),
  ]);
  const names = new Map(data.residents.map((r) => [r.id, r.name]));
  const overdue = buildReceipts(data.charges, data.payments, names, today).filter(
    (r) => r.status === "overdue",
  );
  return {
    ...counts,
    paymentsToReview: data.payments.filter((p) => p.status === "in_review").length,
    overdueResidents: new Set(overdue.map((r) => r.residentId)).size,
    upcomingMoves: pendingMovesSoon(moves, today),
  };
}

// Mensajes de residentes o comensales que el arrendador todavía no leyó.
function unreadFor(tx: Tx, businessId: string) {
  return tx
    .select({ n: count })
    .from(message)
    .innerJoin(resident, eq(resident.id, message.residentId))
    .where(and(eq(resident.businessId, businessId), eq(message.fromResident, true), isNull(message.readAt)));
}

async function pensionCounts(tx: Tx, businessId: string): Promise<Partial<LandlordCounts>> {
  const [counts] = await tx
    .select({
      pensionProofs: scalar(
        tx
          .select({ n: count })
          .from(pensionPayment)
          .innerJoin(pensionSubscription, eq(pensionSubscription.id, pensionPayment.subscriptionId))
          .innerJoin(pensionPlan, eq(pensionPlan.id, pensionSubscription.planId))
          .where(and(eq(pensionPlan.businessId, businessId), eq(pensionPayment.status, "in_review"))),
      ),
      unreadMessages: scalar(unreadFor(tx, businessId)),
    })
    .from(business)
    .where(eq(business.id, businessId));
  return counts ?? {};
}

const ZERO: LandlordCounts = {
  paymentsToReview: 0,
  overdueResidents: 0,
  documentsToReview: 0,
  disputedDiscounts: 0,
  contractsToSign: 0,
  pensionProofs: 0,
  openMaintenance: 0,
  urgentMaintenance: 0,
  newApplications: 0,
  residentsWithoutRoom: 0,
  upcomingMoves: 0,
  unreadMessages: 0,
  tasksDue: 0,
  tasksLate: 0,
  cleaningRequests: 0,
  dirtyUnits: 0,
};

// "Pendientes" del Panel (DB-01, DB-03) para el negocio elegido arriba.
export async function getLandlordPending(
  businessId: string,
  service: "residence" | "meal_plan",
): Promise<PendingItem[]> {
  const claims = await getSessionClaims();
  const counts = await withRls(claims, (tx) =>
    service === "residence" ? residenceCounts(tx, businessId) : pensionCounts(tx, businessId),
  );
  return landlordPending({ ...ZERO, ...counts });
}

// "Pendientes" del inicio del residente, sumando todas sus residencias.
export async function getMyPending(): Promise<PendingItem[]> {
  const [{ residences }, billing, deposits, reviewables, mine] = await Promise.all([
    getMyResidences(),
    getMyBilling(),
    getMyDeposits(),
    listMyReviewables().catch(() => []),
    myMessagesAndParcels(),
  ]);
  const today = limaToday(new Date());
  const reportDays = deposits
    .map(({ deposit: d }) => (d?.canReport ? businessDaysLeft(today, d.reportUntil) : null))
    .filter((n): n is number => n !== null);
  return residentPending({
    missingDocuments: residences.reduce((n, r) => n + r.missing, 0),
    overdueReceipts: billing.reduce((n, b) => n + b.receipts.filter((r) => r.status === "overdue").length, 0),
    contractToSign: residences.some((r) => r.contract?.phase === "pending_signature"),
    settlementToAnswer: deposits.some(
      ({ deposit: d }) => d?.settlement?.status === "sent" && d.settlement.acceptedAt === null,
    ),
    entryReportDaysLeft: reportDays.length ? Math.min(...reportDays) : null,
    unreadMessages: mine.unreadMessages,
    parcelsToPickUp: mine.parcels,
    reviewsToWrite: reviewables.length,
  });
}

// Mensajes sin leer de su residencia y paquetes por recoger, de todas sus fichas (en una sola consulta).
async function myMessagesAndParcels(): Promise<{ unreadMessages: number; parcels: number }> {
  const claims = await getSessionClaims();
  return withRls(claims, async (tx) => {
    const cards = tx
      .select({ id: resident.id })
      .from(resident)
      .where(sql`${resident.personId} in (select id from public.person where user_id = ${claims.sub})`);
    const [row] = await tx
      .select({
        unreadMessages: scalar(
          tx
            .select({ n: count })
            .from(message)
            .where(
              and(
                inArray(message.residentId, cards),
                eq(message.fromResident, false),
                isNull(message.readAt),
              ),
            ),
        ),
        parcels: scalar(
          tx
            .select({ n: count })
            .from(parcel)
            .where(and(inArray(parcel.residentId, cards), isNull(parcel.deliveredAt))),
        ),
      })
      .from(person)
      .where(eq(person.userId, claims.sub));
    return row ?? { unreadMessages: 0, parcels: 0 };
  });
}
