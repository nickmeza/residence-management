import "server-only";

import { asc, eq } from "drizzle-orm";

import { withRls } from "@/db/rls";
import { business, depositSettings, depositUnitException, floor, property, unit } from "@/db/schema";
import { getSessionClaims } from "@/server/auth/session";
import { isRentable, type UnitInput } from "@/server/building/rules";
import { isUuid } from "@/server/business/queries";
import type { DepositSettingsData } from "@/server/payments/schemas";

import type { DepositRule, InspectionArea } from "./rules";

// Configuración › Garantía (GA-01, GA-02, GA-03) y el cobro del mes incompleto.

type Tx = Parameters<Parameters<typeof withRls>[1]>[0];

export type DepositSettingsView = {
  tradeName: string;
  values: {
    roomRule: DepositRule;
    roomFixedAmount: string;
    apartmentRule: DepositRule;
    apartmentFixedAmount: string;
    covers: InspectionArea[];
    refundDays: string;
    refundMethods: ("yape" | "plin" | "transfer" | "cash" | "card")[];
    entryReportDays: string;
    prorateRent: boolean;
  };
  // Si nunca se guardó: todavía no se pide garantía a nadie.
  saved: boolean;
  units: { id: string; label: string; type: "room" | "apartment"; monthlyPrice: string | null }[];
  exceptions: { unitId: string; rule: DepositRule; fixedAmount: string | null }[];
};

const amountText = (v: string | null) => (v ? String(Number(v)) : "");

export async function getDepositSettings(businessId: string): Promise<DepositSettingsView | null> {
  if (!isUuid(businessId)) return null;
  const claims = await getSessionClaims();
  return withRls(claims, async (tx) => {
    const [b] = await tx
      .select({ tradeName: business.tradeName, prorateRent: business.prorateRent })
      .from(business)
      .where(eq(business.id, businessId))
      .limit(1);
    if (!b) return null;
    const [s] = await tx
      .select()
      .from(depositSettings)
      .where(eq(depositSettings.businessId, businessId))
      .limit(1);
    const units = await tx
      .select({
        id: unit.id,
        parentId: unit.parentUnitId,
        type: unit.type,
        name: unit.name,
        rentalMode: unit.rentalMode,
        occupiesWholeFloor: unit.occupiesWholeFloor,
        monthlyPrice: unit.monthlyPrice,
        x: unit.posX,
        z: unit.posZ,
        width: unit.width,
        depth: unit.depth,
        propertyName: property.name,
      })
      .from(unit)
      .innerJoin(floor, eq(floor.id, unit.floorId))
      .innerJoin(property, eq(property.id, floor.propertyId))
      .where(eq(property.businessId, businessId))
      .orderBy(asc(property.name), asc(unit.name));
    const byId = new Map<string, UnitInput>(units.map((u) => [u.id, u]));
    const rentable = units.filter((u) => isRentable(u, byId));
    const many = new Set(units.map((u) => u.propertyName)).size > 1;
    const exceptions = await tx
      .select({
        unitId: depositUnitException.unitId,
        rule: depositUnitException.rule,
        fixedAmount: depositUnitException.fixedAmount,
      })
      .from(depositUnitException)
      .innerJoin(unit, eq(unit.id, depositUnitException.unitId))
      .innerJoin(floor, eq(floor.id, unit.floorId))
      .innerJoin(property, eq(property.id, floor.propertyId))
      .where(eq(property.businessId, businessId));
    return {
      tradeName: b.tradeName,
      saved: Boolean(s),
      values: {
        roomRule: s?.roomRule ?? "one_month",
        roomFixedAmount: amountText(s?.roomFixedAmount ?? null),
        apartmentRule: s?.apartmentRule ?? "one_month",
        apartmentFixedAmount: amountText(s?.apartmentFixedAmount ?? null),
        covers: s?.covers ?? ["walls", "door", "window", "furniture", "keys", "cleaning"],
        refundDays: String(s?.refundDays ?? 7),
        refundMethods: s?.refundMethods ?? ["yape", "plin", "transfer"],
        entryReportDays: String(s?.entryReportDays ?? 7),
        prorateRent: b.prorateRent,
      },
      units: rentable.map((u) => ({
        id: u.id,
        label: many ? `${u.propertyName} · ${u.name}` : u.name,
        type: u.type,
        monthlyPrice: u.monthlyPrice,
      })),
      exceptions,
    };
  });
}

export class SettingsError extends Error {}

export async function saveDepositSettings(tx: Tx, businessId: string, data: DepositSettingsData) {
  const { prorateRent, ...settings } = data;
  const updated = await tx
    .update(business)
    .set({ prorateRent })
    .where(eq(business.id, businessId))
    .returning({ id: business.id });
  if (!updated.length) throw new SettingsError("No encontramos tu negocio. Recarga la página.");
  await tx
    .insert(depositSettings)
    .values({ businessId, ...settings })
    .onConflictDoUpdate({ target: depositSettings.businessId, set: { ...settings, updatedAt: new Date() } });
}

// La unidad tiene que ser de un negocio de quien inició sesión (el RLS lo revisa al escribir).
export async function saveUnitException(
  tx: Tx,
  data: { unitId: string; rule: DepositRule; fixedAmount: string | null },
) {
  const [own] = await tx.select({ id: unit.id }).from(unit).where(eq(unit.id, data.unitId)).limit(1);
  if (!own) throw new SettingsError("Elige una unidad de tu negocio.");
  await tx
    .insert(depositUnitException)
    .values(data)
    .onConflictDoUpdate({
      target: depositUnitException.unitId,
      set: { rule: data.rule, fixedAmount: data.fixedAmount },
    });
}

export async function deleteUnitException(tx: Tx, unitId: string) {
  await tx.delete(depositUnitException).where(eq(depositUnitException.unitId, unitId));
}
