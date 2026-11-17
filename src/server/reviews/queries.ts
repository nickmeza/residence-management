import "server-only";

import { eq, inArray, sql } from "drizzle-orm";

import { withRls } from "@/db/rls";
import { contract, person, resident, review } from "@/db/schema";
import { getSessionClaims } from "@/server/auth/session";
import { isUuid } from "@/server/business/queries";
import { limaToday } from "@/server/contracts/dates";
import { getMyShell } from "@/server/residents/self";

import { canReview, reviewSummary, type ReviewScores, type ReviewSummary } from "./rules";

export type ReceivedReview = ReviewScores & {
  id: string;
  // Vacíos si la reseña es anónima (los quita la función de la base, no la pantalla).
  residentName: string | null;
  unitName: string | null;
  comment: string | null;
  recommends: boolean;
  anonymous: boolean;
  createdAt: Date;
};

type Row = {
  id: string;
  resident_name: string | null;
  unit_name: string | null;
  room: number;
  cleaning: number;
  treatment: number;
  coexistence: number;
  meal_plan: number | null;
  comment: string | null;
  recommends: boolean;
  anonymous: boolean;
  created_at: string | Date;
};

// Reseñas recibidas por un negocio (CR-05) y sus promedios. Vacío si el negocio no es de quien inició sesión.
export async function getBusinessReviews(
  businessId: string,
): Promise<{ reviews: ReceivedReview[]; summary: ReviewSummary }> {
  if (!isUuid(businessId)) return { reviews: [], summary: reviewSummary([]) };
  const claims = await getSessionClaims();
  const rows = (await withRls(claims, (tx) =>
    tx.execute(sql`select * from public.business_reviews(${businessId}::uuid)`),
  )) as unknown as Row[];
  const reviews = rows.map((r) => ({
    id: r.id,
    residentName: r.resident_name,
    unitName: r.unit_name,
    room: r.room,
    cleaning: r.cleaning,
    treatment: r.treatment,
    coexistence: r.coexistence,
    mealPlan: r.meal_plan,
    comment: r.comment,
    recommends: r.recommends,
    anonymous: r.anonymous,
    createdAt: new Date(r.created_at),
  }));
  return { reviews, summary: reviewSummary(reviews) };
}

export type MyReviewable = {
  contractId: string;
  residentId: string;
  businessName: string;
  startDate: string;
  endDate: string;
};

// Contratos del residente que ya puede calificar (terminaron, no se renovaron y aún no los calificó).
export async function listMyReviewables(): Promise<MyReviewable[]> {
  const [shell, claims] = await Promise.all([getMyShell(), getSessionClaims()]);
  const today = limaToday(new Date());
  return withRls(claims, async (tx) => {
    const cards = await tx
      .select({ id: resident.id, businessId: resident.businessId })
      .from(resident)
      .innerJoin(person, eq(person.id, resident.personId))
      .where(eq(person.userId, claims.sub));
    if (!cards.length) return [];
    const ids = cards.map((c) => c.id);
    const [contracts, done] = await Promise.all([
      tx
        .select({
          id: contract.id,
          residentId: contract.residentId,
          status: contract.status,
          startDate: contract.startDate,
          endDate: contract.endDate,
          renewedFromId: contract.renewedFromId,
        })
        .from(contract)
        .where(inArray(contract.residentId, ids)),
      tx.select({ contractId: review.contractId }).from(review).where(inArray(review.residentId, ids)),
    ]);
    const reviewed = new Set(done.map((d) => d.contractId));
    const renewed = new Set(
      contracts.filter((c) => c.renewedFromId && c.status !== "cancelled").map((c) => c.renewedFromId),
    );
    const business = new Map(cards.map((c) => [c.id, c.businessId]));
    const names = new Map(shell.contacts.map((c) => [c.businessId, c.businessName]));
    return contracts
      .filter((c) =>
        canReview(
          { status: c.status, endDate: c.endDate, renewed: renewed.has(c.id), reviewed: reviewed.has(c.id) },
          today,
        ),
      )
      .map((c) => ({
        contractId: c.id,
        residentId: c.residentId,
        businessName: names.get(business.get(c.residentId) ?? "") ?? "Tu residencia",
        startDate: c.startDate,
        endDate: c.endDate!,
      }));
  });
}
