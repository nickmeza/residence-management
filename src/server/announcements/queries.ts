import "server-only";

import { asc, desc, eq } from "drizzle-orm";

import { withRls } from "@/db/rls";
import { announcement, business, floor, person, property, resident } from "@/db/schema";
import { getSessionClaims } from "@/server/auth/session";
import { floorName } from "@/server/building/floors";
import { isUuid } from "@/server/business/queries";

export type AnnouncementRow = {
  id: string;
  title: string;
  body: string;
  urgent: boolean;
  audienceLabel: string;
  recipients: number;
  createdAt: Date;
};

export type AudienceOptions = {
  service: "residence" | "meal_plan";
  properties: { id: string; name: string }[];
  floors: { id: string; label: string }[];
  residents: { id: string; name: string }[];
};

// Lo enviado (lo más nuevo primero) y a quién se puede mandar. null si el negocio no es de quien inició sesión.
export async function getAnnouncements(
  businessId: string,
): Promise<{ rows: AnnouncementRow[]; options: AudienceOptions } | null> {
  if (!isUuid(businessId)) return null;
  const claims = await getSessionClaims();
  return withRls(claims, async (tx) => {
    const [b] = await tx
      .select({ service: business.service })
      .from(business)
      .where(eq(business.id, businessId))
      .limit(1);
    if (!b) return null;
    const [sent, properties, floors, residents] = await Promise.all([
      tx
        .select({
          id: announcement.id,
          title: announcement.title,
          body: announcement.body,
          urgent: announcement.urgent,
          audience: announcement.audience,
          recipients: announcement.recipients,
          createdAt: announcement.createdAt,
          propertyName: property.name,
          floorLevel: floor.level,
          residentName: person.fullName,
        })
        .from(announcement)
        .leftJoin(property, eq(property.id, announcement.propertyId))
        .leftJoin(floor, eq(floor.id, announcement.floorId))
        .leftJoin(resident, eq(resident.id, announcement.residentId))
        .leftJoin(person, eq(person.id, resident.personId))
        .where(eq(announcement.businessId, businessId))
        .orderBy(desc(announcement.createdAt))
        .limit(100),
      tx
        .select({ id: property.id, name: property.name })
        .from(property)
        .where(eq(property.businessId, businessId))
        .orderBy(asc(property.name)),
      tx
        .select({ id: floor.id, level: floor.level, propertyName: property.name })
        .from(floor)
        .innerJoin(property, eq(property.id, floor.propertyId))
        .where(eq(property.businessId, businessId))
        .orderBy(asc(property.name), asc(floor.level)),
      tx
        .select({ id: resident.id, name: person.fullName })
        .from(resident)
        .innerJoin(person, eq(person.id, resident.personId))
        .where(eq(resident.businessId, businessId))
        .orderBy(asc(person.fullName)),
    ]);
    const many = properties.length > 1;
    const floorLabel = (level: number, propertyName: string | null) =>
      many && propertyName ? `${propertyName} · ${floorName(level)}` : floorName(level);
    const audienceLabel = (r: (typeof sent)[number]) => {
      if (r.audience === "all") return "Todos";
      if (r.audience === "property") return r.propertyName ?? "Un edificio";
      if (r.audience === "floor")
        return r.floorLevel !== null ? floorLabel(r.floorLevel, r.propertyName) : "Un piso";
      return r.residentName ?? "Una persona";
    };
    return {
      rows: sent.map((r) => ({
        id: r.id,
        title: r.title,
        body: r.body,
        urgent: r.urgent,
        audienceLabel: audienceLabel(r),
        recipients: r.recipients,
        createdAt: r.createdAt,
      })),
      options: {
        service: b.service,
        properties,
        floors: floors.map((f) => ({ id: f.id, label: floorLabel(f.level, f.propertyName) })),
        residents,
      },
    };
  });
}
