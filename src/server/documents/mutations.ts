import "server-only";

import { eq } from "drizzle-orm";

import type { withRls } from "@/db/rls";
import { business, document, documentRequirement, property } from "@/db/schema";

import type { RequirementData } from "./schemas";

// Cambios de requisitos de documentos dentro de una transacción con la sesión (RLS).

type Tx = Parameters<Parameters<typeof withRls>[1]>[0];

export class DocumentError extends Error {}

// La propiedad elegida debe ser de este negocio.
async function checkProperty(tx: Tx, businessId: string, propertyId: string | null) {
  if (!propertyId) return;
  const [p] = await tx
    .select({ businessId: property.businessId })
    .from(property)
    .where(eq(property.id, propertyId))
    .limit(1);
  if (!p || p.businessId !== businessId) throw new DocumentError("Elige una propiedad de este negocio.");
}

export async function createRequirement(tx: Tx, businessId: string, data: RequirementData) {
  const [own] = await tx
    .select({ id: business.id })
    .from(business)
    .where(eq(business.id, businessId))
    .limit(1);
  if (!own) throw new DocumentError("No encontramos tu negocio. Recarga la página.");
  await checkProperty(tx, businessId, data.propertyId);
  const [row] = await tx
    .insert(documentRequirement)
    .values({ businessId, ...data })
    .returning({ id: documentRequirement.id });
  return row.id;
}

export async function updateRequirement(tx: Tx, id: string, data: RequirementData) {
  const [current] = await tx
    .select({ businessId: documentRequirement.businessId })
    .from(documentRequirement)
    .where(eq(documentRequirement.id, id))
    .limit(1);
  if (!current) throw new DocumentError("No encontramos ese documento. Recarga la página.");
  await checkProperty(tx, current.businessId, data.propertyId);
  await tx.update(documentRequirement).set(data).where(eq(documentRequirement.id, id));
  return current.businessId;
}

// Si ya hay archivos subidos para este requisito, se conservan: quedan como "otro documento".
// Va antes de borrar: al borrar, la base deja vacío el enlace y ya no se sabría cuáles eran.
export async function deleteRequirement(tx: Tx, id: string) {
  await tx.update(document).set({ kind: "other" }).where(eq(document.requirementId, id));
  const [row] = await tx
    .delete(documentRequirement)
    .where(eq(documentRequirement.id, id))
    .returning({ businessId: documentRequirement.businessId });
  if (!row) throw new DocumentError("No encontramos ese documento. Recarga la página.");
  return row.businessId;
}
