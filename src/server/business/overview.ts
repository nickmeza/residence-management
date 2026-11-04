import "server-only";

import { asc, eq, inArray } from "drizzle-orm";

import { withRls } from "@/db/rls";
import { business, floor, person, property, unit } from "@/db/schema";
import { getSessionClaims } from "@/server/auth/session";
import { buildingSummary, type UnitInput } from "@/server/building/rules";

export type BusinessOverview = {
  id: string;
  service: "residence" | "meal_plan";
  tradeName: string;
  properties: { id: string; name: string; floors: number; apartments: number; rentable: number }[];
};

// Lo que el panel muestra: los negocios de quien inició sesión y un resumen de cada propiedad.
// Corre con su sesión: el RLS garantiza que solo vea lo suyo.
export async function getMyOverview(): Promise<{ fullName: string; businesses: BusinessOverview[] }> {
  const claims = await getSessionClaims();
  return withRls(claims, async (tx) => {
    const [me] = await tx
      .select({ fullName: person.fullName })
      .from(person)
      .where(eq(person.userId, claims.sub));
    const businesses = await tx
      .select({ id: business.id, service: business.service, tradeName: business.tradeName })
      .from(business)
      .orderBy(asc(business.service), asc(business.tradeName));
    const properties = businesses.length
      ? await tx
          .select({ id: property.id, businessId: property.businessId, name: property.name })
          .from(property)
          .where(
            inArray(
              property.businessId,
              businesses.map((b) => b.id),
            ),
          )
      : [];
    const floors = properties.length
      ? await tx
          .select({ id: floor.id, propertyId: floor.propertyId })
          .from(floor)
          .where(
            inArray(
              floor.propertyId,
              properties.map((p) => p.id),
            ),
          )
      : [];
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
      : [];

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

    return {
      fullName: me?.fullName ?? "",
      businesses: businesses.map((b) => ({
        ...b,
        properties: properties
          .filter((p) => p.businessId === b.id)
          .map((p) => {
            const ofProperty = floors.filter((f) => f.propertyId === p.id);
            const summary = buildingSummary(
              ofProperty.map((f) => ({ units: units.filter((u) => u.floorId === f.id).map(toRule) })),
            );
            return { id: p.id, name: p.name, ...summary };
          }),
      })),
    };
  });
}
