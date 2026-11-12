import "server-only";

import { asc, eq } from "drizzle-orm";

import { withRls } from "@/db/rls";
import { business, documentRequirement } from "@/db/schema";
import { getSessionClaims } from "@/server/auth/session";
import { isUuid } from "@/server/business/queries";

export type RequirementRow = {
  id: string;
  name: string;
  description: string | null;
  unitType: "room" | "apartment";
  required: boolean;
  active: boolean;
  acceptedFormats: ("pdf" | "image")[];
  maxSizeMb: number;
};

// Requisitos de un negocio (las dos listas) para Configuración › Documentos. null si no es de quien inició sesión.
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
    const requirements = await tx
      .select({
        id: documentRequirement.id,
        name: documentRequirement.name,
        description: documentRequirement.description,
        unitType: documentRequirement.unitType,
        required: documentRequirement.required,
        active: documentRequirement.active,
        acceptedFormats: documentRequirement.acceptedFormats,
        maxSizeMb: documentRequirement.maxSizeMb,
      })
      .from(documentRequirement)
      .where(eq(documentRequirement.businessId, businessId))
      .orderBy(asc(documentRequirement.name));
    return { tradeName: b.tradeName, requirements: requirements as RequirementRow[] };
  });
}
