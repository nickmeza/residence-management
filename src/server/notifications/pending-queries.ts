import "server-only";

import { and, eq, inArray, isNull, lte, sql } from "drizzle-orm";

import { withRls } from "@/db/rls";
import {
  application,
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

// Una cuenta de una tabla de la Fase 7 en un punto de guardado: si la migración todavía no se aplicó, cuenta 0 en
// lugar de romper el Panel.
async function optional(tx: Tx, query: (sp: Tx) => Promise<number>): Promise<number> {
  try {
    return await tx.transaction((sp) => query(sp));
  } catch {
    return 0;
  }
}

// Mensajes de residentes o comensales que el arrendador todavía no leyó.
function unreadFor(tx: Tx, businessId: string) {
  return optional(tx, async (sp) => {
    const [r] = await sp
      .select({ n: count })
      .from(message)
      .innerJoin(resident, eq(resident.id, message.residentId))
      .where(
        and(eq(resident.businessId, businessId), eq(message.fromResident, true), isNull(message.readAt)),
      );
    return r.n;
  });
}

// Tareas que se repiten, limpieza pedida y unidades por limpiar (Fase 7, segunda parte).
async function operationCounts(tx: Tx, businessId: string, today: string) {
  const activeTasks = and(eq(recurringTask.businessId, businessId), eq(recurringTask.active, true));
  // Uno tras otro: cada cuenta va en su propio punto de guardado de la misma transacción.
  const tasksDue = await optional(tx, async (sp) => {
    const [r] = await sp
      .select({ n: count })
      .from(recurringTask)
      .where(and(activeTasks, lte(recurringTask.nextDue, addDays(today, DUE_SOON_DAYS))));
    return r.n;
  });
  const tasksLate = await optional(tx, async (sp) => {
    const [r] = await sp
      .select({ n: count })
      .from(recurringTask)
      .where(and(activeTasks, sql`${recurringTask.nextDue} < ${today}`));
    return r.n;
  });
  const cleaningRequests = await optional(tx, async (sp) => {
    const [r] = await sp
      .select({ n: count })
      .from(cleaningRequest)
      .where(and(eq(cleaningRequest.businessId, businessId), eq(cleaningRequest.status, "requested")));
    return r.n;
  });
  const dirtyUnits = await optional(tx, async (sp) => {
    const [r] = await sp
      .select({ n: count })
      .from(unit)
      .innerJoin(floor, eq(floor.id, unit.floorId))
      .innerJoin(property, eq(property.id, floor.propertyId))
      .where(and(eq(property.businessId, businessId), eq(unit.cleaningStatus, "dirty")));
    return r.n;
  });
  return { tasksDue, tasksLate, cleaningRequests, dirtyUnits };
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

  const data = await loadBusiness(tx, businessId);
  const names = new Map(data.residents.map((r) => [r.id, r.name]));
  const overdue = buildReceipts(data.charges, data.payments, names, today).filter(
    (r) => r.status === "overdue",
  );

  const [[documents], [disputes], [toSign]] = await Promise.all([
    tx
      .select({ n: count })
      .from(document)
      .where(and(eq(document.status, "in_review"), inArray(document.residentId, residentIds))),
    tx
      .select({ n: count })
      .from(settlementDiscount)
      .innerJoin(settlement, eq(settlement.id, settlementDiscount.settlementId))
      .innerJoin(deposit, eq(deposit.id, settlement.depositId))
      .where(and(eq(settlementDiscount.status, "disputed"), inArray(deposit.contractId, contractIds))),
    tx
      .select({ n: count })
      .from(contract)
      .where(and(eq(contract.status, "pending_signature"), inArray(contract.residentId, residentIds))),
  ]);
  const active = and(
    eq(maintenanceRequest.businessId, businessId),
    inArray(maintenanceRequest.status, ["open", "in_progress"]),
  );
  const openMaintenance = await optional(tx, async (sp) => {
    const [r] = await sp.select({ n: count }).from(maintenanceRequest).where(active);
    return r.n;
  });
  const urgentMaintenance = await optional(tx, async (sp) => {
    const [r] = await sp
      .select({ n: count })
      .from(maintenanceRequest)
      .where(and(active, eq(maintenanceRequest.priority, "urgent")));
    return r.n;
  });
  const newApplications = await optional(tx, async (sp) => {
    const [r] = await sp
      .select({ n: count })
      .from(application)
      .where(and(eq(application.businessId, businessId), eq(application.status, "new")));
    return r.n;
  });
  return {
    paymentsToReview: data.payments.filter((p) => p.status === "in_review").length,
    overdueResidents: new Set(overdue.map((r) => r.residentId)).size,
    documentsToReview: documents.n,
    disputedDiscounts: disputes.n,
    contractsToSign: toSign.n,
    openMaintenance,
    urgentMaintenance,
    newApplications,
    upcomingMoves: pendingMovesSoon(await movesIn(tx, businessId), today),
    unreadMessages: await unreadFor(tx, businessId),
    ...(await operationCounts(tx, businessId, today)),
  };
}

async function pensionCounts(tx: Tx, businessId: string): Promise<Partial<LandlordCounts>> {
  const [r] = await tx
    .select({ n: count })
    .from(pensionPayment)
    .innerJoin(pensionSubscription, eq(pensionSubscription.id, pensionPayment.subscriptionId))
    .innerJoin(pensionPlan, eq(pensionPlan.id, pensionSubscription.planId))
    .where(and(eq(pensionPlan.businessId, businessId), eq(pensionPayment.status, "in_review")));
  return { pensionProofs: r.n, unreadMessages: await unreadFor(tx, businessId) };
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

// Mensajes sin leer de su residencia y paquetes por recoger, de todas sus fichas.
async function myMessagesAndParcels(): Promise<{ unreadMessages: number; parcels: number }> {
  const claims = await getSessionClaims();
  return withRls(claims, async (tx) => {
    const cards = tx
      .select({ id: resident.id })
      .from(resident)
      .where(sql`${resident.personId} in (select id from public.person where user_id = ${claims.sub})`);
    const unreadMessages = await optional(tx, async (sp) => {
      const [r] = await sp
        .select({ n: count })
        .from(message)
        .where(
          and(inArray(message.residentId, cards), eq(message.fromResident, false), isNull(message.readAt)),
        );
      return r.n;
    });
    const parcels = await optional(tx, async (sp) => {
      const [r] = await sp
        .select({ n: count })
        .from(parcel)
        .where(and(inArray(parcel.residentId, cards), isNull(parcel.deliveredAt)));
      return r.n;
    });
    return { unreadMessages, parcels };
  });
}
