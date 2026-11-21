import "server-only";

import { asc, desc, eq, inArray, sql } from "drizzle-orm";

import { withRls } from "@/db/rls";
import { business, cleaningRequest, floor, person, property, resident, unit } from "@/db/schema";
import { getSessionClaims } from "@/server/auth/session";
import { floorName } from "@/server/building/floors";
import { isUuid } from "@/server/business/queries";

import { compareUnits, type CleaningRequestStatus, type CleaningStatus } from "./rules";

export type CleaningUnit = { id: string; label: string; status: CleaningStatus };

export type CleaningRequestRow = {
  id: string;
  residentName: string;
  unitName: string | null;
  note: string | null;
  preferredDate: string | null;
  scheduledFor: string | null;
  status: CleaningRequestStatus;
  createdAt: Date;
};

// Limpieza del negocio (MT-05): si acepta pedidos, el estado de cada unidad y los pedidos de los residentes (los
// abiertos y los de los últimos 30 días). null si el negocio no es de quien inició sesión.
export async function getCleaningBoard(businessId: string): Promise<{
  acceptsRequests: boolean;
  units: CleaningUnit[];
  requests: CleaningRequestRow[];
} | null> {
  if (!isUuid(businessId)) return null;
  const claims = await getSessionClaims();
  return withRls(claims, async (tx) => {
    const [b] = await tx
      .select({ accepts: business.acceptsCleaningRequests })
      .from(business)
      .where(eq(business.id, businessId))
      .limit(1);
    if (!b) return null;
    const since = new Date(Date.now() - 30 * 86_400_000);
    const [units, requests] = await Promise.all([
      tx
        .select({
          id: unit.id,
          name: unit.name,
          type: unit.type,
          rentalMode: unit.rentalMode,
          status: unit.cleaningStatus,
          level: floor.level,
          propertyName: property.name,
        })
        .from(unit)
        .innerJoin(floor, eq(floor.id, unit.floorId))
        .innerJoin(property, eq(property.id, floor.propertyId))
        .where(eq(property.businessId, businessId))
        .orderBy(asc(property.name), asc(floor.level), asc(unit.name)),
      tx
        .select({
          id: cleaningRequest.id,
          residentName: person.fullName,
          unitName: unit.name,
          note: cleaningRequest.note,
          preferredDate: cleaningRequest.preferredDate,
          scheduledFor: cleaningRequest.scheduledFor,
          status: cleaningRequest.status,
          createdAt: cleaningRequest.createdAt,
        })
        .from(cleaningRequest)
        .innerJoin(resident, eq(resident.id, cleaningRequest.residentId))
        .innerJoin(person, eq(person.id, resident.personId))
        .leftJoin(unit, eq(unit.id, cleaningRequest.unitId))
        .where(
          sql`${cleaningRequest.businessId} = ${businessId} and (${inArray(cleaningRequest.status, ["requested", "scheduled"])} or ${cleaningRequest.createdAt} >= ${since})`,
        )
        .orderBy(desc(cleaningRequest.createdAt)),
    ]);
    const many = new Set(units.map((u) => u.propertyName)).size > 1;
    return {
      acceptsRequests: b.accepts,
      // Un departamento por cuartos se limpia cuarto por cuarto: el departamento no se lista.
      units: units
        .filter((u) => u.rentalMode !== "by_room")
        .map((u) => ({
          id: u.id,
          label: `${many ? `${u.propertyName} · ` : ""}${floorName(u.level)} · ${u.name}`,
          status: u.status,
        }))
        .sort(compareUnits),
      requests,
    };
  });
}

export type MyCleaningPlace = { residentId: string; contractId: string; label: string };

export type MyCleaningRequest = {
  id: string;
  note: string | null;
  preferredDate: string | null;
  scheduledFor: string | null;
  status: CleaningRequestStatus;
  createdAt: Date;
};

// Para el residente: en qué residencias puede pedir limpieza (las que lo prendieron) y sus pedidos.
export async function getMyCleaning(
  places: { residentId: string; businessId: string; contractId: string; label: string }[],
): Promise<{ places: MyCleaningPlace[]; requests: MyCleaningRequest[] }> {
  if (!places.length) return { places: [], requests: [] };
  const claims = await getSessionClaims();
  return withRls(claims, async (tx) => {
    const businessIds = [...new Set(places.map((p) => p.businessId))];
    const accepting = new Set<string>();
    for (const id of businessIds) {
      const [r] = (await tx.execute(
        sql`select public.business_accepts_cleaning(${id}::uuid) as ok`,
      )) as unknown as { ok: boolean }[];
      if (r?.ok) accepting.add(id);
    }
    const requests = await tx
      .select({
        id: cleaningRequest.id,
        note: cleaningRequest.note,
        preferredDate: cleaningRequest.preferredDate,
        scheduledFor: cleaningRequest.scheduledFor,
        status: cleaningRequest.status,
        createdAt: cleaningRequest.createdAt,
      })
      .from(cleaningRequest)
      .where(
        inArray(
          cleaningRequest.residentId,
          places.map((p) => p.residentId),
        ),
      )
      .orderBy(desc(cleaningRequest.createdAt))
      .limit(20);
    return {
      places: places
        .filter((p) => accepting.has(p.businessId))
        .map(({ residentId, contractId, label }) => ({ residentId, contractId, label })),
      requests,
    };
  });
}
