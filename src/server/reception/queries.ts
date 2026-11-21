import "server-only";

import { and, asc, desc, eq, gte, isNull, or } from "drizzle-orm";

import { withRls } from "@/db/rls";
import { business, parcel, person, resident, visit } from "@/db/schema";
import { getSessionClaims } from "@/server/auth/session";
import { isUuid } from "@/server/business/queries";

// Visitas (CM-05) y paquetes (CM-06) del negocio. Lo hace el arrendador: no hay recepción ni roles.

export type VisitRow = {
  id: string;
  visitorName: string;
  residentName: string | null;
  arrivedAt: Date;
  leftAt: Date | null;
  note: string | null;
};

export type ParcelRow = {
  id: string;
  description: string;
  residentName: string;
  receivedAt: Date;
  deliveredAt: Date | null;
  deliveredTo: string | null;
};

// Cuántos días de historial se muestran (lo que sigue adentro o sin entregar se muestra siempre).
export const HISTORY_DAYS = 30;

async function residentsOf(tx: Parameters<Parameters<typeof withRls>[1]>[0], businessId: string) {
  return tx
    .select({ id: resident.id, name: person.fullName })
    .from(resident)
    .innerJoin(person, eq(person.id, resident.personId))
    .where(eq(resident.businessId, businessId))
    .orderBy(asc(person.fullName));
}

const since = () => new Date(Date.now() - HISTORY_DAYS * 86_400_000);

export async function listVisits(
  businessId: string,
): Promise<{ rows: VisitRow[]; residents: { id: string; name: string }[] } | null> {
  if (!isUuid(businessId)) return null;
  const claims = await getSessionClaims();
  return withRls(claims, async (tx) => {
    const [b] = await tx
      .select({ id: business.id })
      .from(business)
      .where(eq(business.id, businessId))
      .limit(1);
    if (!b) return null;
    const [rows, residents] = await Promise.all([
      tx
        .select({
          id: visit.id,
          visitorName: visit.visitorName,
          residentName: person.fullName,
          arrivedAt: visit.arrivedAt,
          leftAt: visit.leftAt,
          note: visit.note,
        })
        .from(visit)
        .leftJoin(resident, eq(resident.id, visit.residentId))
        .leftJoin(person, eq(person.id, resident.personId))
        .where(and(eq(visit.businessId, businessId), or(isNull(visit.leftAt), gte(visit.arrivedAt, since()))))
        .orderBy(desc(visit.arrivedAt)),
      residentsOf(tx, businessId),
    ]);
    return { rows, residents };
  });
}

export async function listParcels(
  businessId: string,
): Promise<{ rows: ParcelRow[]; residents: { id: string; name: string }[] } | null> {
  if (!isUuid(businessId)) return null;
  const claims = await getSessionClaims();
  return withRls(claims, async (tx) => {
    const [b] = await tx
      .select({ id: business.id })
      .from(business)
      .where(eq(business.id, businessId))
      .limit(1);
    if (!b) return null;
    const [rows, residents] = await Promise.all([
      tx
        .select({
          id: parcel.id,
          description: parcel.description,
          residentName: person.fullName,
          receivedAt: parcel.receivedAt,
          deliveredAt: parcel.deliveredAt,
          deliveredTo: parcel.deliveredTo,
        })
        .from(parcel)
        .innerJoin(resident, eq(resident.id, parcel.residentId))
        .innerJoin(person, eq(person.id, resident.personId))
        .where(
          and(
            eq(parcel.businessId, businessId),
            or(isNull(parcel.deliveredAt), gte(parcel.receivedAt, since())),
          ),
        )
        .orderBy(desc(parcel.receivedAt)),
      residentsOf(tx, businessId),
    ]);
    return { rows, residents };
  });
}
