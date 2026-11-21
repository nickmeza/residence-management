import "server-only";

import { and, eq } from "drizzle-orm";

import type { withRls } from "@/db/rls";
import {
  announcement,
  business,
  contract,
  floor,
  pensionPlan,
  pensionSubscription,
  person,
  property,
  resident,
  unit,
} from "@/db/schema";
import { limaToday } from "@/server/contracts/dates";
import { announcement as announcementNotice } from "@/server/notifications/catalog";
import { notifyResidents } from "@/server/notifications/notify";

import { pensionRecipients, residenceRecipients, type Audience } from "./rules";
import type { AnnouncementData } from "./schemas";

type Tx = Parameters<Parameters<typeof withRls>[1]>[0];

export class AnnouncementError extends Error {}

const TARGET_MISSING = "No encontramos a quién se lo mandas. Recarga la página.";

// Lo elegido (persona, edificio o piso) tiene que ser de este negocio. El RLS ya oculta lo ajeno.
async function resolveAudience(tx: Tx, businessId: string, data: AnnouncementData): Promise<Audience> {
  const target = data.targetId;
  if (data.audience === "all" || !target) return { kind: "all" };
  if (data.audience === "resident") {
    const [r] = await tx
      .select({ id: resident.id })
      .from(resident)
      .where(and(eq(resident.id, target), eq(resident.businessId, businessId)))
      .limit(1);
    if (!r) throw new AnnouncementError(TARGET_MISSING);
    return { kind: "resident", residentId: target };
  }
  if (data.audience === "property") {
    const [p] = await tx
      .select({ id: property.id })
      .from(property)
      .where(and(eq(property.id, target), eq(property.businessId, businessId)))
      .limit(1);
    if (!p) throw new AnnouncementError(TARGET_MISSING);
    return { kind: "property", propertyId: target };
  }
  const [f] = await tx
    .select({ id: floor.id })
    .from(floor)
    .innerJoin(property, eq(property.id, floor.propertyId))
    .where(and(eq(floor.id, target), eq(property.businessId, businessId)))
    .limit(1);
  if (!f) throw new AnnouncementError(TARGET_MISSING);
  return { kind: "floor", floorId: target };
}

// Enviar un comunicado (CM-01): guarda el historial y le crea una notificación a cada destinatario. Devuelve a
// cuántas personas les llegó.
export async function sendAnnouncement(tx: Tx, businessId: string, data: AnnouncementData, userId: string) {
  const [b] = await tx
    .select({ service: business.service })
    .from(business)
    .where(eq(business.id, businessId))
    .limit(1);
  if (!b) throw new AnnouncementError("No encontramos tu negocio. Recarga la página.");
  if (b.service === "meal_plan" && data.audience !== "all" && data.audience !== "resident") {
    throw new AnnouncementError("En una pensión, el comunicado va a todos o a una persona.");
  }
  const audience = await resolveAudience(tx, businessId, data);

  const today = limaToday(new Date());
  let recipients: string[];
  if (audience.kind === "resident") recipients = [audience.residentId];
  else if (b.service === "meal_plan") {
    const subs = await tx
      .select({ residentId: pensionSubscription.residentId, endDate: pensionSubscription.endDate })
      .from(pensionSubscription)
      .innerJoin(pensionPlan, eq(pensionPlan.id, pensionSubscription.planId))
      .where(eq(pensionPlan.businessId, businessId));
    recipients = pensionRecipients(subs, today);
  } else {
    const [contracts, units] = await Promise.all([
      tx
        .select({
          residentId: contract.residentId,
          unitId: contract.unitId,
          startDate: contract.startDate,
          endDate: contract.endDate,
          status: contract.status,
        })
        .from(contract)
        .innerJoin(resident, eq(resident.id, contract.residentId))
        .where(eq(resident.businessId, businessId)),
      tx
        .select({ id: unit.id, floorId: unit.floorId, propertyId: floor.propertyId })
        .from(unit)
        .innerJoin(floor, eq(floor.id, unit.floorId))
        .innerJoin(property, eq(property.id, floor.propertyId))
        .where(eq(property.businessId, businessId)),
    ]);
    recipients = residenceRecipients(audience, contracts, units, today);
  }
  if (!recipients.length) {
    throw new AnnouncementError("Nadie vive ahí hoy: el comunicado no le llegaría a nadie.");
  }

  const [me] = await tx.select({ id: person.id }).from(person).where(eq(person.userId, userId)).limit(1);
  if (!me) throw new AnnouncementError("No encontramos tu cuenta. Vuelve a iniciar sesión.");
  await tx.insert(announcement).values({
    businessId,
    audience: audience.kind,
    propertyId: audience.kind === "property" ? audience.propertyId : null,
    floorId: audience.kind === "floor" ? audience.floorId : null,
    residentId: audience.kind === "resident" ? audience.residentId : null,
    title: data.title,
    body: data.body,
    urgent: data.urgent,
    recipients: recipients.length,
    createdBy: me.id,
  });
  await notifyResidents(tx, recipients, announcementNotice(data.title, data.body, data.urgent));
  return recipients.length;
}
