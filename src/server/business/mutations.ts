import "server-only";

import { eq } from "drizzle-orm";

import type { db } from "@/db";
import { business, contractTemplate, documentRequirement, property, resident } from "@/db/schema";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export class BusinessError extends Error {}

// Borra un negocio con todo lo suyo: edificios (sus pisos y unidades se van en cascada), plantillas,
// documentos requeridos y configuración de garantía (en cascada). Solo si no tiene residentes: así nadie
// pierde contratos, pagos ni la bitácora de dinero por un clic (decisión del dueño). Corre con la sesión
// (withRls): si el negocio no es de quien lo pide, el RLS lo oculta y no se borra nada.
export async function deleteBusiness(tx: Tx, id: string): Promise<void> {
  const [found] = await tx.select({ id: business.id }).from(business).where(eq(business.id, id)).limit(1);
  if (!found) throw new BusinessError("No encontramos ese negocio.");
  const [someone] = await tx
    .select({ id: resident.id })
    .from(resident)
    .where(eq(resident.businessId, id))
    .limit(1);
  if (someone) {
    throw new BusinessError(
      "Este negocio tiene residentes, así que no se puede eliminar. Sus contratos y pagos se conservan.",
    );
  }
  await tx.delete(property).where(eq(property.businessId, id));
  await tx.delete(contractTemplate).where(eq(contractTemplate.businessId, id));
  await tx.delete(documentRequirement).where(eq(documentRequirement.businessId, id));
  await tx.delete(business).where(eq(business.id, id));
}
