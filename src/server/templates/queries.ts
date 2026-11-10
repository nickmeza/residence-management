import "server-only";

import { asc, eq } from "drizzle-orm";

import { withRls } from "@/db/rls";
import { business, contractTemplate } from "@/db/schema";
import { getSessionClaims } from "@/server/auth/session";
import { isUuid } from "@/server/business/queries";

export type TemplateRow = { id: string; name: string; body: string; updatedAt: Date };

// Plantillas de un negocio para Configuración › Plantillas. null si el negocio no es de quien inició sesión.
export async function listTemplates(
  businessId: string,
): Promise<{ tradeName: string; templates: TemplateRow[] } | null> {
  if (!isUuid(businessId)) return null;
  const claims = await getSessionClaims();
  return withRls(claims, async (tx) => {
    const [b] = await tx
      .select({ tradeName: business.tradeName })
      .from(business)
      .where(eq(business.id, businessId))
      .limit(1);
    if (!b) return null;
    const templates = await tx
      .select({
        id: contractTemplate.id,
        name: contractTemplate.name,
        body: contractTemplate.body,
        updatedAt: contractTemplate.updatedAt,
      })
      .from(contractTemplate)
      .where(eq(contractTemplate.businessId, businessId))
      .orderBy(asc(contractTemplate.name));
    return { tradeName: b.tradeName, templates };
  });
}
