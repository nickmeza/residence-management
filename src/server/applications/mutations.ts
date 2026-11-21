import "server-only";

import { and, eq } from "drizzle-orm";

import type { withRls } from "@/db/rls";
import { application, business } from "@/db/schema";
import { createResident } from "@/server/residents/mutations";

import { applicationMoves, type ApplicationStatus } from "./rules";

type Tx = Parameters<Parameters<typeof withRls>[1]>[0];

export class ApplicationReviewError extends Error {}

// Prender o apagar el enlace público de postulación de un negocio de Residencia.
export async function setAcceptsApplications(tx: Tx, businessId: string, on: boolean) {
  const updated = await tx
    .update(business)
    .set({ acceptsApplications: on })
    .where(and(eq(business.id, businessId), eq(business.service, "residence")))
    .returning({ id: business.id });
  if (!updated.length) throw new ApplicationReviewError("Las postulaciones son de un negocio de Residencia.");
}

// Revisar una postulación (RS-04, RS-05). Aprobar crea su ficha de residente con sus datos (sin cuenta todavía): desde
// ahí se le asigna una unidad con un contrato (RS-06) y se le invita. Devuelve la ficha creada, si la hay.
export async function reviewApplication(
  tx: Tx,
  id: string,
  review: { status: Exclude<ApplicationStatus, "new">; note: string | null },
): Promise<string | null> {
  const [a] = await tx.select().from(application).where(eq(application.id, id)).limit(1);
  if (!a) throw new ApplicationReviewError("No encontramos esa postulación. Recarga la página.");
  if (!applicationMoves(a.status).includes(review.status)) {
    throw new ApplicationReviewError(
      a.status === "approved"
        ? "Esta postulación ya está aprobada: sigue desde la ficha del residente."
        : "Esa postulación ya está en ese estado.",
    );
  }
  let residentId: string | null = null;
  if (review.status === "approved") {
    residentId = await createResident(tx, a.businessId, {
      fullName: a.fullName,
      phone: a.phone,
      email: a.email,
      identityDocumentType: null,
      identityDocumentNumber: null,
      university: a.occupation,
      emergencyContactName: null,
      emergencyContactPhone: null,
      notes: a.message ? `Postulación: ${a.message}` : null,
    });
    if (!residentId) throw new ApplicationReviewError("No encontramos tu negocio. Recarga la página.");
  }
  await tx
    .update(application)
    .set({ status: review.status, note: review.note, residentId, reviewedAt: new Date() })
    .where(eq(application.id, id));
  return residentId;
}
