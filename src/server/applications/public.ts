import "server-only";

import { and, eq, gt } from "drizzle-orm";

import { db } from "@/db";
import { application, business } from "@/db/schema";
import { applicationReceived } from "@/server/notifications/catalog";
import { insertAsAdmin } from "@/server/notifications/notify";

import { isRepeated } from "./rules";
import type { ApplicationData } from "./schemas";

// El formulario público de postulación (/postular/<negocio>). Quien postula no tiene cuenta, así que esto corre como
// administrador (sin RLS), igual que aceptar una invitación. Lo que autoriza es que el negocio tenga las
// postulaciones prendidas; solo se devuelve su nombre y su ciudad, nada más.

export class ApplicationError extends Error {}

export type ApplicationForm = { tradeName: string; city: string | null };

async function openBusiness(businessId: string) {
  const [b] = await db
    .select({ tradeName: business.tradeName, city: business.city, ownerId: business.ownerId })
    .from(business)
    .where(
      and(
        eq(business.id, businessId),
        eq(business.service, "residence"),
        eq(business.acceptsApplications, true),
      ),
    )
    .limit(1);
  return b ?? null;
}

// null si el enlace no existe o el negocio no recibe postulaciones.
export async function getApplicationForm(businessId: string): Promise<ApplicationForm | null> {
  try {
    const b = await openBusiness(businessId);
    return b ? { tradeName: b.tradeName, city: b.city } : null;
  } catch (e) {
    // Sin la migración 0023 todavía no existe la columna: el enlace no sirve.
    console.error(e);
    return null;
  }
}

export async function submitApplication(businessId: string, data: ApplicationData) {
  const b = await openBusiness(businessId);
  if (!b) throw new ApplicationError("Esta residencia no está recibiendo postulaciones por ahora.");
  return db.transaction(async (tx) => {
    const now = new Date();
    const recent = await tx
      .select({ phone: application.phone, createdAt: application.createdAt })
      .from(application)
      .where(
        and(
          eq(application.businessId, businessId),
          gt(application.createdAt, new Date(now.getTime() - 24 * 3_600_000)),
        ),
      );
    if (isRepeated(recent, data.phone, now)) {
      throw new ApplicationError("Ya recibimos tu postulación. La residencia te escribirá pronto.");
    }
    const { accepts: _accepted, ...fields } = data;
    void _accepted;
    const [row] = await tx
      .insert(application)
      .values({ businessId, ...fields })
      .returning({ id: application.id });
    await insertAsAdmin(tx, b.ownerId, businessId, applicationReceived(data.fullName, row.id));
    return b.tradeName;
  });
}
