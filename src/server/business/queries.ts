import "server-only";

import { asc, eq, inArray } from "drizzle-orm";

import { cache } from "react";
import { z } from "zod";

import { withRls } from "@/db/rls";
import { business, contract, floor, person, property, resident, unit, type OutlinePoint } from "@/db/schema";
import { getSessionClaims } from "@/server/auth/session";
import { buildingSummary, type UnitInput } from "@/server/building/rules";
import { unitStatus, type UnitStatus } from "@/server/building/status";
import { limaToday } from "@/server/contracts/dates";
import { occupiesToday } from "@/server/contracts/rules";

// Un id con formato inválido (por ejemplo, escrito a mano en la dirección) es "no encontrado", no un error.
export const isUuid = (id: string) => z.uuid().safeParse(id).success;

// Un negocio para editarlo. null si no existe o no es de quien inició sesión (el RLS lo oculta).
export async function getBusinessForEdit(id: string) {
  if (!isUuid(id)) return null;
  const claims = await getSessionClaims();
  const [row] = await withRls(claims, (tx) => tx.select().from(business).where(eq(business.id, id)).limit(1));
  return row ?? null;
}

export type BuildingUnit = {
  id: string;
  name: string;
  type: "apartment" | "room";
  rentalMode: "whole" | "by_room" | null;
  occupiesWholeFloor: boolean;
  monthlyPrice: string | null;
  areaM2: string | null;
  bathroom: "private" | "shared" | null;
  furnished: boolean;
  spaceType: "bedroom" | "studio" | "office" | "storage" | "other" | null;
  // Rectángulo en la planta, en metros (para el 3D).
  rect: { x: number; z: number; width: number; depth: number };
  status: UnitStatus;
  // Quién vive hoy: su contrato o el de su departamento (si se alquila completo). null si está libre.
  occupant: Occupant | null;
  rooms: BuildingUnit[];
};

export type Occupant = {
  contractId: string;
  residentId: string;
  name: string;
  startDate: string;
  endDate: string | null;
};

export type BuildingView = {
  id: string;
  name: string;
  businessId: string;
  coverPhotoPath: string | null;
  floors: { id: string; level: number; outline: OutlinePoint[]; units: BuildingUnit[] }[];
  summary: { floors: number; apartments: number; rentable: number; occupied: number };
};

// Una propiedad con sus pisos y unidades, para la pantalla Edificio. null si no es de quien inició sesión.
// cache(): el marco del edificio (layout) y la página la piden en la misma visita y se consulta una sola vez.
export const getBuilding = cache(async (propertyId: string): Promise<BuildingView | null> => {
  if (!isUuid(propertyId)) return null;
  const claims = await getSessionClaims();
  return withRls(claims, async (tx) => {
    const [prop] = await tx
      .select({
        id: property.id,
        name: property.name,
        businessId: property.businessId,
        coverPhotoPath: property.coverPhotoPath,
      })
      .from(property)
      .where(eq(property.id, propertyId))
      .limit(1);
    if (!prop) return null;
    const floors = await tx
      .select({ id: floor.id, level: floor.level, outline: floor.outline })
      .from(floor)
      .where(eq(floor.propertyId, prop.id))
      .orderBy(asc(floor.level));
    const units = floors.length
      ? await tx
          .select()
          .from(unit)
          .where(
            inArray(
              unit.floorId,
              floors.map((f) => f.id),
            ),
          )
          .orderBy(asc(unit.name))
      : [];
    // Ocupada: ella o su departamento tiene un contrato que ocupa la unidad hoy (acordado, firmado o pendiente).
    const contracts = units.length
      ? await tx
          .select({
            id: contract.id,
            unitId: contract.unitId,
            residentId: contract.residentId,
            name: person.fullName,
            startDate: contract.startDate,
            endDate: contract.endDate,
            status: contract.status,
          })
          .from(contract)
          .innerJoin(resident, eq(resident.id, contract.residentId))
          .innerJoin(person, eq(person.id, resident.personId))
          .where(
            inArray(
              contract.unitId,
              units.map((u) => u.id),
            ),
          )
      : [];
    const today = limaToday(new Date());
    const occupantByUnit = new Map<string, Occupant>(
      contracts
        .filter((c) => occupiesToday(c, today))
        .map((c) => [
          c.unitId,
          { contractId: c.id, residentId: c.residentId, name: c.name, startDate: c.startDate, endDate: c.endDate },
        ]),
    );
    const occupantOf = (u: (typeof units)[number]) =>
      occupantByUnit.get(u.id) ?? (u.parentUnitId ? occupantByUnit.get(u.parentUnitId) : undefined) ?? null;

    const toView = (u: (typeof units)[number]): BuildingUnit => ({
      id: u.id,
      name: u.name,
      type: u.type,
      rentalMode: u.rentalMode,
      occupiesWholeFloor: u.occupiesWholeFloor,
      monthlyPrice: u.monthlyPrice,
      areaM2: u.areaM2,
      bathroom: u.bathroom,
      furnished: u.furnished,
      spaceType: u.spaceType,
      rect: { x: u.posX, z: u.posZ, width: u.width, depth: u.depth },
      status: unitStatus({ hasActiveContract: occupantOf(u) !== null }),
      occupant: occupantOf(u),
      rooms: units.filter((r) => r.parentUnitId === u.id).map(toView),
    });
    const toRule = (u: (typeof units)[number]): UnitInput => ({
      id: u.id,
      parentId: u.parentUnitId,
      type: u.type,
      name: u.name,
      rentalMode: u.rentalMode,
      occupiesWholeFloor: u.occupiesWholeFloor,
      monthlyPrice: u.monthlyPrice,
      x: u.posX,
      z: u.posZ,
      width: u.width,
      depth: u.depth,
    });

    const viewFloors = floors.map((f) => ({
      id: f.id,
      level: f.level,
      outline: f.outline,
      units: units.filter((u) => u.floorId === f.id && !u.parentUnitId).map(toView),
    }));
    const summary = buildingSummary(
      floors.map((f) => ({ units: units.filter((u) => u.floorId === f.id).map(toRule) })),
    );
    const occupied = viewFloors
      .flatMap((f) => f.units.flatMap((u) => [u, ...u.rooms]))
      .filter((u) => u.status === "occupied").length;
    return { ...prop, floors: viewFloors, summary: { ...summary, occupied } };
  });
});
