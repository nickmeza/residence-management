import "server-only";

import { asc, desc, eq } from "drizzle-orm";

import { withRls } from "@/db/rls";
import { application, business, contract, floor, property, resident, unit } from "@/db/schema";
import { getSessionClaims } from "@/server/auth/session";
import { isRentable } from "@/server/building/rules";
import { isUuid } from "@/server/business/queries";
import { limaToday } from "@/server/contracts/dates";
import { overlappingContracts } from "@/server/contracts/rules";

import { suggestUnit, type SuggestionCandidate, type UnitSuggestion } from "./rules";

export type ApplicationRow = typeof application.$inferSelect;

// Postulaciones de un negocio, las más nuevas primero, y si el enlace público está prendido. null si el negocio no
// es de quien inició sesión.
export async function listApplications(
  businessId: string,
): Promise<{ accepting: boolean; rows: ApplicationRow[] } | null> {
  if (!isUuid(businessId)) return null;
  const claims = await getSessionClaims();
  return withRls(claims, async (tx) => {
    const [b] = await tx
      .select({ accepting: business.acceptsApplications })
      .from(business)
      .where(eq(business.id, businessId))
      .limit(1);
    if (!b) return null;
    const rows = await tx
      .select()
      .from(application)
      .where(eq(application.businessId, businessId))
      .orderBy(desc(application.createdAt));
    return { accepting: b.accepting, rows };
  });
}

export async function getApplication(id: string): Promise<ApplicationRow | null> {
  if (!isUuid(id)) return null;
  const claims = await getSessionClaims();
  const [row] = await withRls(claims, (tx) =>
    tx.select().from(application).where(eq(application.id, id)).limit(1),
  );
  return row ?? null;
}

// Cuarto sugerido para una postulación: entre lo que se alquila, tiene precio y está libre desde hoy (sin contrato
// pendiente de firma ni confirmado que lo ocupe hoy o más adelante, contando su departamento o sus cuartos), el que
// mejor calza con lo que busca y su presupuesto (ver suggestUnit).
export async function getUnitSuggestion(a: ApplicationRow): Promise<UnitSuggestion | null> {
  const claims = await getSessionClaims();
  const today = limaToday(new Date());
  return withRls(claims, async (tx) => {
    const [units, contracts] = await Promise.all([
      tx
        .select({
          id: unit.id,
          parentId: unit.parentUnitId,
          type: unit.type,
          rentalMode: unit.rentalMode,
          name: unit.name,
          monthlyPrice: unit.monthlyPrice,
          propertyName: property.name,
        })
        .from(unit)
        .innerJoin(floor, eq(floor.id, unit.floorId))
        .innerJoin(property, eq(property.id, floor.propertyId))
        .where(eq(property.businessId, a.businessId))
        .orderBy(asc(property.name), asc(unit.name)),
      tx
        .select({
          id: contract.id,
          unitId: contract.unitId,
          startDate: contract.startDate,
          endDate: contract.endDate,
          status: contract.status,
        })
        .from(contract)
        .innerJoin(resident, eq(resident.id, contract.residentId))
        .where(eq(resident.businessId, a.businessId)),
    ]);
    const byId = new Map(units.map((u) => [u.id, u]));
    const candidates: SuggestionCandidate[] = units.flatMap((u) =>
      u.monthlyPrice !== null &&
      isRentable(u, byId) &&
      overlappingContracts({ id: "", unitId: u.id, startDate: today, endDate: null }, contracts, units)
        .length === 0
        ? [{ id: u.id, type: u.type, label: `${u.name} · ${u.propertyName}`, monthlyPrice: u.monthlyPrice }]
        : [],
    );
    return suggestUnit(candidates, { unitType: a.unitType, budget: a.budget });
  });
}
