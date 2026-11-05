import "server-only";

import { asc, eq, inArray } from "drizzle-orm";

import { z } from "zod";

import { withRls } from "@/db/rls";
import { business, floor, property, unit, type OutlinePoint } from "@/db/schema";
import { getSessionClaims } from "@/server/auth/session";
import { buildingSummary, type UnitInput } from "@/server/building/rules";
import { unitStatus, type UnitStatus } from "@/server/building/status";

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
  rooms: BuildingUnit[];
};

export type BuildingView = {
  id: string;
  name: string;
  businessId: string;
  floors: { id: string; level: number; outline: OutlinePoint[]; units: BuildingUnit[] }[];
  summary: { floors: number; apartments: number; rentable: number; occupied: number };
};

// Una propiedad con sus pisos y unidades, para la pantalla Edificio. null si no es de quien inició sesión.
export async function getBuilding(propertyId: string): Promise<BuildingView | null> {
  if (!isUuid(propertyId)) return null;
  const claims = await getSessionClaims();
  return withRls(claims, async (tx) => {
    const [prop] = await tx
      .select({ id: property.id, name: property.name, businessId: property.businessId })
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
      status: unitStatus(),
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
}
