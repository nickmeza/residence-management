import "server-only";

import type { db } from "@/db";
import { business, floor, property, unit } from "@/db/schema";

import { buildFloors } from "./build";
import type { BusinessSetup, Setup } from "./schema";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

const businessRow = (ownerId: string, service: "residence" | "meal_plan", b: BusinessSetup) => ({
  ownerId,
  service,
  kind: b.kind,
  tradeName: b.tradeName,
  legalName: b.legalName,
  ruc: b.ruc,
  phone: b.phone,
  contactEmail: b.contactEmail,
  city: b.city,
  address: b.address,
  paymentMethods: b.paymentMethods,
  billingDay: b.billingDay,
});

// Guarda negocios, propiedad, pisos y unidades de una Persona. Debe correr dentro de una transacción:
// si algo falla a mitad de camino, no queda nada guardado a medias.
export async function insertSetup(tx: Tx, personId: string, setup: Setup): Promise<void> {
  if (setup.mealPlan) {
    await tx.insert(business).values(businessRow(personId, "meal_plan", setup.mealPlan));
  }
  if (!setup.residence || !setup.property) return;

  const [residence] = await tx
    .insert(business)
    .values(businessRow(personId, "residence", setup.residence))
    .returning({ id: business.id });

  const p = setup.property;
  const [prop] = await tx
    .insert(property)
    .values({
      businessId: residence.id,
      name: p.name,
      address: p.address,
      districtCity: p.districtCity,
      type: p.type,
      ownerLivesHere: p.ownerLivesHere === "yes",
    })
    .returning({ id: property.id });

  for (const f of buildFloors(p)) {
    const [savedFloor] = await tx
      .insert(floor)
      .values({ propertyId: prop.id, level: f.level, outline: f.outline })
      .returning({ id: floor.id });

    // Primero las unidades sueltas, después los cuartos interiores (necesitan el id de su departamento).
    const idByKey = new Map<string, string>();
    for (const pass of [false, true]) {
      for (const u of f.units.filter((x) => (x.parentKey !== null) === pass)) {
        const [saved] = await tx
          .insert(unit)
          .values({
            floorId: savedFloor.id,
            parentUnitId: u.parentKey ? idByKey.get(u.parentKey) : null,
            type: u.type,
            name: u.name,
            rentalMode: u.rentalMode,
            occupiesWholeFloor: u.occupiesWholeFloor,
            monthlyPrice: u.monthlyPrice,
            areaM2: u.areaM2,
            posX: u.posX,
            posZ: u.posZ,
            width: u.width,
            depth: u.depth,
          })
          .returning({ id: unit.id });
        idByKey.set(u.key, saved.id);
      }
    }
  }
}
