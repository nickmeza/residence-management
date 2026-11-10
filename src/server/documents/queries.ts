import "server-only";

import { asc, eq } from "drizzle-orm";

import { withRls } from "@/db/rls";
import { business, documentRequirement, property } from "@/db/schema";
import { getSessionClaims } from "@/server/auth/session";
import { isUuid } from "@/server/business/queries";

export type RequirementRow = {
  id: string;
  name: string;
  description: string | null;
  propertyId: string | null;
  required: boolean;
  acceptedFormats: ("pdf" | "image")[];
  maxSizeMb: number;
};

// Requisitos y propiedades de un negocio para Configuración › Documentos. null si no es de quien inició sesión.
export async function listRequirements(businessId: string) {
  if (!isUuid(businessId)) return null;
  const claims = await getSessionClaims();
  return withRls(claims, async (tx) => {
    const [b] = await tx
      .select({ tradeName: business.tradeName })
      .from(business)
      .where(eq(business.id, businessId))
      .limit(1);
    if (!b) return null;
    const [requirements, properties] = await Promise.all([
      tx
        .select({
          id: documentRequirement.id,
          name: documentRequirement.name,
          description: documentRequirement.description,
          propertyId: documentRequirement.propertyId,
          required: documentRequirement.required,
          acceptedFormats: documentRequirement.acceptedFormats,
          maxSizeMb: documentRequirement.maxSizeMb,
        })
        .from(documentRequirement)
        .where(eq(documentRequirement.businessId, businessId))
        .orderBy(asc(documentRequirement.name)),
      tx
        .select({ id: property.id, name: property.name })
        .from(property)
        .where(eq(property.businessId, businessId))
        .orderBy(asc(property.name)),
    ]);
    return { tradeName: b.tradeName, requirements: requirements as RequirementRow[], properties };
  });
}
